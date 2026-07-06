/**
 * CHIVE (Connected Hierarchical Interactive Visualization Engine)
 *, Main Application Orchestrator.
 *
 * Boot sequence (see {@link initializeApplication}):
 *   1. Initialize i18n (await, must precede any translated render).
 *   2. Hydrate persisted state from IndexedDB BEFORE wiring subscribers,
 *      so restoration does not trigger a redundant save and the first
 *      render sees the restored state.
 *   3. Initialize fileManager / chartControls / panelManager.
 *   4. Wire global DOM listeners via `eventHandlers`.
 *   5. Subscribe each render-affecting state event to its scheduler
 *      (`scheduleFullRefresh` for full repaints, `scheduleRegion` for narrowed
 *      events); see `setupStateSubscriptions` for the canonical mapping.
 *   6. Enable debounced auto-save.
 *   7. Initial render.
 *   8. Re-render on locale changes.
 *   9. Surface internal module errors via feedback toast.
 *
 * @typedef {import('./types.js').AppState} AppState
 * @typedef {import('./types.js').Dataset} Dataset
 */

import { initializeI18n, t } from './services/i18nService.js';
import {
	isPersistenceAvailable,
	hydrateState,
	enablePersistenceAutoSave,
	getPersistenceErrorMessageKey,
} from './services/persistenceService.js';
import {
renderEmptyState,
renderDataInterface,
renderFileList,
} from './components/datasetWorkspace/datasetWorkspaceView.js';
import { renderCharts } from './components/datasetWorkspace/chartsView.js';
import { initChartControls, renderChartControlsSidebar } from './modules/chartControls/chartControlsManager.js';
import { getNumericColumns } from './utils/columnHelpers.js';
import { rehydratePanelChartSpecs } from './utils/panelHydration.js';
import { throttle } from './utils/throttle.js';

import {
getState,
getPersistenceSnapshot,
getActiveDataset,
getActiveDatasetIndex,
getPreviewRows,
onStateChange,
STATE_EVENTS,
setPreviewRows,
updateActiveDatasetColumns,
updateActiveDatasetConfig,
replaceAllState,
} from './modules/state/appState.js';
import {
enableStateLog,
disableStateLog,
getStateLog,
clearStateLog,
} from './modules/state/stateEvents.js';
import { getStateSummary } from './modules/state/stateDebug.js';
import {
initPanelManager,
initializeLayoutSelector,
renderSidebarPanel,
renderCanvasPanel,
} from './modules/panelManager.js';
import {
initFileManager,
getLoadedDatasets,
selectDataset,
removeDatasetByIndex,
handleJoinDatasetRequest,
handlePresetDatasetRequest,
} from './modules/fileManager.js';
import { initializeAllEventHandlers } from './modules/eventHandlers.js';
import {
showFeedback,
showFeedbackMessage,
showError,
showErrorMessage,
} from './modules/feedbackUI.js';
import { switchTab } from './modules/uiManager.js';

// =============================================================================
// APPLICATION INITIALIZATION
// =============================================================================

/**
 * Master initialization. Called once when the DOM is ready (or
 * immediately if already past `DOMContentLoaded`). Short-circuits on
 * pages that lack the main app UI (e.g. `about.html`) after i18n is set
 * up, since those pages still need translated text but no app logic.
 *
 * @private
 * @returns {Promise<void>}
 */
async function initializeApplication() {
// 1. Initialize i18n system
await initializeI18n();

// Only run app logic on pages that have the main app UI
if (!document.getElementById('file-info')) return;

// 2. Hydrate persisted state BEFORE any subscriber is wired, so the act of
//    restoring doesn't immediately schedule a redundant save and refreshView
//    sees the restored state on first paint.
if (isPersistenceAvailable()) {
	await hydrateState({
		replaceAllState,
		transformPanel: rehydratePanelChartSpecs,
	});
}

// 3. Initialize modules
initFileManager();
// WHY: 120ms rate limit on live preview. Color pickers and height drags emit
// events every frame; unthrottled, each one re-renders the active chart, which
// stutters on heavy charts (TIN triangulation).
// Leading+trailing throttle keeps the first and final values painted.
initChartControls(null, throttle(livePreviewRender, 120));
initPanelManager(showFeedback);

// 4. Setup event handlers (must be after modules initialized)
initializeAllEventHandlers();

// 5. Setup UI subscriptions
setupStateSubscriptions();

// 6. Wire auto-save AFTER subscriptions. The controller tracks semantic
//    project events, debounces saves, and flushes on page hide/freeze/close.
//    getPersistenceSnapshot (no JSON clone, live refs) keeps the heavy deep
//    clone getState performs off the save hot path; the worker backend dedups
//    unchanged row/snapshot payloads by reference.
enablePersistenceAutoSave(getPersistenceSnapshot, {
	onSaveError: reportPersistenceSaveError,
});

// 7. Initial view render
runFullRefreshNow();

// 8. Re-render dynamic content on locale changes
window.addEventListener('chive-locale-changed', () => {
scheduleFullRefresh();
});

// 9. Surface internal module errors in UI feedback
window.addEventListener('chive-internal-error', event => {
const message = event?.detail?.message || t('chive-error-internal');
showError(message);
});
}

function reportPersistenceSaveError(error) {
	showError(t(getPersistenceErrorMessageKey(error)));
}

/**
 * Generic internal-error text, resilient to an i18n subsystem that may
 * itself have failed to initialize (so the translation lookup cannot make
 * the error handler throw).
 *
 * @private
 * @returns {string}
 */
function internalErrorMessage() {
	try {
		return t('chive-error-internal');
	} catch {
		return 'An internal application error occurred.';
	}
}

/**
 * Last-resort handler for a failure during {@link initializeApplication}.
 * `initializeI18n` reveals `document.body` only as its final step, so a
 * failure before that point would otherwise leave a blank, hidden page.
 * Force the body visible, log the real error for diagnosis, and surface a
 * generic message to the user.
 *
 * @private
 * @param {unknown} error
 */
function reportInitializationError(error) {
	document.body.style.visibility = 'visible';
	console.error('CHIVE initialization failed:', error);
	showError(internalErrorMessage());
}

// =============================================================================
// STATE SUBSCRIPTIONS & CALLBACKS
// =============================================================================

// State events repaint through two coalescing entries that share one `fullQueued`
// guard, so "full wins": scheduleFullRefresh() repaints everything on the next
// microtask (dataset add/remove/select, hydration, locale); scheduleRegion()
// drains a dirty-region set, repainting only the affected areas. runFullRefreshNow()
// is the synchronous full-render entry for boot and the debug handle. Never call
// refreshView() bare: it would not set `fullQueued`, so a region queued in the
// same tick (a synchronous burst of events) would not be coalesced, and the
// guard would stop protecting against re-entrant emits during a render.

// Render areas a region flush can repaint (typo-safe registry, mirrors STATE_EVENTS).
const RENDER_REGIONS = Object.freeze({
	list: 'list',
	workspace: 'workspace',
	controls: 'controls',
	panel: 'panel',
});

const dirtyRegions = new Set();
let regionFlushQueued = false;
let fullQueued = false;

/**
 * Report a render error through the `chive-internal-error` channel (surfaced as a
 * toast) rather than letting it escape as an unhandled rejection.
 *
 * @private
 * @param {unknown} err
 */
function reportRefreshError(err) {
	window.dispatchEvent(new CustomEvent('chive-internal-error', {
		detail: { type: 'refresh-error', message: String(err?.message || err) },
	}));
}

/**
 * Mark a render area dirty and schedule a single coalesced region flush on the
 * next microtask. Regions dirtied in the same tick render once, in a fixed
 * canonical order (list, workspace, controls, panel) so the workspace reveals the
 * panel tab before the panel sizes against it. No-op while a full refresh is
 * pending, which subsumes every region.
 *
 * @private
 * @param {(typeof RENDER_REGIONS)[keyof typeof RENDER_REGIONS]} region
 */
function scheduleRegion(region) {
	if (fullQueued) return;
	dirtyRegions.add(region);
	if (regionFlushQueued) return;
	regionFlushQueued = true;
	Promise.resolve().then(() => {
		regionFlushQueued = false;
		if (fullQueued) {
			dirtyRegions.clear();
			return;
		}
		const regions = new Set(dirtyRegions);
		dirtyRegions.clear();
		try {
			if (regions.has(RENDER_REGIONS.list)) {
				renderDatasetListView(getLoadedDatasets(), getActiveDatasetIndex());
			}
			if (regions.has(RENDER_REGIONS.workspace)) {
				renderActiveDatasetWorkspace(getActiveDataset(), getPreviewRows());
			}
			if (regions.has(RENDER_REGIONS.controls)) {
				renderChartControlsView(getActiveDataset());
			}
			if (regions.has(RENDER_REGIONS.panel)) {
				renderPanelWorkspace();
			}
		} catch (err) {
			reportRefreshError(err);
		}
	});
}

/**
 * Schedule a coalesced full `refreshView()` on the next microtask. Holds
 * `fullQueued` for the whole render (cleared in `finally`) so any region scheduled
 * during it (e.g. the global-filter sanitize emit) is suppressed rather than
 * double-painted, and a thrown render cannot wedge future schedules. Errors are
 * reported via {@link reportRefreshError}, since a microtask rejection has nowhere
 * to bubble.
 *
 * @private
 */
function scheduleFullRefresh() {
	if (fullQueued) return;
	fullQueued = true;
	dirtyRegions.clear();
	Promise.resolve().then(() => {
		try {
			refreshView();
		} catch (err) {
			reportRefreshError(err);
		} finally {
			dirtyRegions.clear();
			fullQueued = false;
		}
	});
}

/**
 * Run a full `refreshView()` synchronously with the same `fullQueued` protection
 * as {@link scheduleFullRefresh}, for the non-bus callers that need an immediate
 * paint: boot and the `window.chiveDebug` handle. Saves/restores the prior
 * `fullQueued` so it is re-entrancy safe. Unlike the scheduled path it does NOT
 * catch: a boot render error must reject `initializeApplication()` (the
 * `chive-internal-error` listener is wired only after the first render), and a
 * debug call surfaces the throw in the console.
 *
 * @private
 */
function runFullRefreshNow() {
	const wasFullQueued = fullQueued;
	fullQueued = true;
	dirtyRegions.clear();
	try {
		refreshView();
	} finally {
		dirtyRegions.clear();
		fullQueued = wasFullQueued;
	}
}

/**
 * Repaint the regions a column-selection change affects: the active workspace
 * (preview table, stats, charts) and the chart-controls sidebar. The file list and
 * panel are unaffected. Only fires with an active dataset, so the empty branch
 * never applies.
 *
 * @private
 */
function onColumnsUpdated() {
	scheduleRegion(RENDER_REGIONS.workspace);
	scheduleRegion(RENDER_REGIONS.controls);
}

/**
 * Route a config change by payload. Every CONFIG_UPDATED repaints the active
 * workspace and the chart-controls sidebar (a chart option, chart-type activation,
 * or global-filter change). An `activeTab` switch to the panel tab additionally
 * repaints the panel so its blocks size against the now-visible container; the
 * workspace region runs first in the canonical flush order, revealing the tab
 * before the panel paints. Other payloads leave the panel alone: its blocks paint
 * from frozen snapshots, so a config edit cannot change them. Only fires with an
 * active dataset, so the empty branch never applies.
 *
 * @private
 * @param {{ activeTab?: string } & Object} [patch] - The CONFIG_UPDATED payload.
 */
function onConfigUpdated(patch) {
	scheduleRegion(RENDER_REGIONS.workspace);
	scheduleRegion(RENDER_REGIONS.controls);
	if (patch?.activeTab === 'panel') scheduleRegion(RENDER_REGIONS.panel);
}

/**
 * Wire every render-affecting state event to its scheduler. Dataset
 * add/remove/select and hydration take the full refresh; column and config changes
 * repaint the workspace and chart-controls regions (config also the panel region
 * when the panel tab opens), and preview-row changes the workspace region.
 *
 * @private
 */
function setupStateSubscriptions() {
onStateChange(STATE_EVENTS.ACTIVE_DATASET, scheduleFullRefresh);
onStateChange(STATE_EVENTS.DATASET_ADDED, scheduleFullRefresh);
onStateChange(STATE_EVENTS.DATASET_REMOVED, scheduleFullRefresh);
onStateChange(STATE_EVENTS.COLUMNS_UPDATED, onColumnsUpdated);
onStateChange(STATE_EVENTS.CONFIG_UPDATED, onConfigUpdated);
onStateChange(STATE_EVENTS.STATE_HYDRATED, scheduleFullRefresh);
onStateChange(STATE_EVENTS.PREVIEW_ROWS_CHANGED, () => scheduleRegion(RENDER_REGIONS.workspace));
}

// =============================================================================
// LIVE PREVIEW RENDER (no controls re-render)
// =============================================================================

/**
 * Re-render only the chart visualizations using the current in-memory
 * dataset config. Called during live previews (e.g. while a color
 * picker is open) so the chart updates as the user drags, without
 * rebuilding the controls sidebar, which would steal focus from the
 * picker.
 *
 * The canvas panel is deliberately not re-rendered here: panel blocks
 * paint from frozen snapshots captured at add time (structuredClone in
 * panelManager), so a live config edit can never change them. The picker's
 * `change` (commit) event fires CONFIG_UPDATED, but that no longer repaints the
 * panel either (only an `activeTab` switch to the panel tab does); the panel keeps
 * showing its frozen snapshot.
 *
 * @private
 */
function livePreviewRender() {
	const dataset = getActiveDataset();
	if (!dataset || !Array.isArray(dataset.columns)) return;
	const columnNames = dataset.columns.map(column => column.name);
	const selectedNames = new Set(
		Array.isArray(dataset.selectedColumns)
			? dataset.selectedColumns
			: columnNames
	);
	const visibleColumns = dataset.columns.filter(column => selectedNames.has(column.name));
	const visibleNumericColumns = getNumericColumns(visibleColumns);
	renderCharts(dataset.chartConfig, dataset.rows, visibleColumns, visibleNumericColumns);
}

// =============================================================================
// MASTER VIEW UPDATE ORCHESTRATOR
// =============================================================================

/**
 * Render the dataset file list (left rail): the file-info header, search,
 * pagination, the active-dataset meta row, and the Join/Preset tools.
 *
 * @private
 * @param {Dataset[]} datasets - All loaded datasets.
 * @param {number} activeIndex - Active dataset index, or -1 when none.
 */
function renderDatasetListView(datasets, activeIndex) {
	renderFileList(
		datasets,
		activeIndex,
		selectDataset,
		removeDatasetByIndex,
		handleJoinDatasetRequest,
		handlePresetDatasetRequest
	);
}

/**
 * Render the "no dataset loaded" dataset workspace; delegates to
 * {@link renderEmptyState}. The panel render and the tab reset are the
 * caller's responsibility.
 *
 * @private
 */
function renderEmptyWorkspace() {
	renderEmptyState();
}

/**
 * Render the active dataset's workspace: column controls, preview table,
 * stats, charts, and global-filter state, all via {@link renderDataInterface}.
 *
 * Committed chart config is canonicalized at the state boundaries (persistence
 * restore, `addDataset`, and the emitting config writes) via
 * `canonicalizeChartConfig`, so render does not repair it; the renderers derive
 * any local display defaults themselves. No-op when no dataset is active.
 *
 * @private
 * @param {Dataset | null} dataset - The active dataset, or null when none.
 * @param {number} previewRows - Number of rows to show in the preview table.
 */
function renderActiveDatasetWorkspace(dataset, previewRows) {
	if (!dataset) return;
	renderDataInterface(
		dataset.rows,
		dataset.columns,
		dataset.name,
		dataset.sizeLabel,
		previewRows,
		updatePreviewRows,
		dataset.selectedColumns,
		updateDatasetColumns,
		dataset.chartConfig,
		updateDatasetConfig
	);
}

/**
 * Render the chart-controls sidebar for the active dataset. No-op when no
 * dataset is active.
 *
 * @private
 * @param {Dataset | null} dataset - The active dataset, or null when none.
 */
function renderChartControlsView(dataset) {
	if (!dataset) return;
	renderChartControlsSidebar(dataset);
}

/**
 * Render the panel workspace: the sidebar (saved snapshots) and the canvas
 * (layout with mounted slots). `withLayoutSelector` repopulates the layout
 * `<select>`; it is on for the active path and off for the empty path, matching
 * the prior behavior where the empty state left the layout selector untouched.
 *
 * @private
 * @param {{ withLayoutSelector?: boolean }} [options]
 */
function renderPanelWorkspace({ withLayoutSelector = true } = {}) {
	if (withLayoutSelector) initializeLayoutSelector();
	renderSidebarPanel();
	renderCanvasPanel();
}

/**
 * Master view update. Gathers what it needs up front through the cheap getters
 * (same read surface as the region flush, no deep clone), then composes the
 * specialized render paths: the dataset list, then either the empty workspace or
 * the active dataset workspace plus its chart controls, then the panel
 * workspace. Each path delegates to its owning render module.
 *
 * Reached two ways: asynchronously via {@link scheduleFullRefresh} for bus events
 * that need a full repaint (plus the locale change), and synchronously via
 * {@link runFullRefreshNow} for the non-bus callers that need an immediate paint
 * (boot and the debug handle). Narrower events repaint only their regions through
 * {@link scheduleRegion}, never this function; do not call it bare.
 *
 * @private
 */
function refreshView() {
	const datasets = getLoadedDatasets();
	const activeIndex = getActiveDatasetIndex();
	const dataset = getActiveDataset();
	const previewRows = getPreviewRows();

	renderDatasetListView(datasets, activeIndex);

	// Empty state: no active dataset workspace, and the layout selector is left
	// untouched (matches the prior empty-path behavior).
	if (datasets.length === 0) {
		renderEmptyWorkspace();
		renderPanelWorkspace({ withLayoutSelector: false });
		switchTab('preview');
		return;
	}

	renderActiveDatasetWorkspace(dataset, previewRows);
	renderChartControlsView(dataset);
	renderPanelWorkspace();
}

/**
 * Apply a column-selection change. Delegates to the data facade; the
 * COLUMNS_UPDATED subscription repaints the workspace and chart-controls regions.
 *
 * @private
 * @param {string[]} columns
 */
function updateDatasetColumns(columns) {
updateActiveDatasetColumns(columns);
}

/**
 * Apply a chart-config change. Delegates to the data facade; the CONFIG_UPDATED
 * subscription repaints the workspace and chart-controls regions (and the panel
 * region when the active tab switches to the panel). The facade canonicalizes the
 * config (default-fill + stale-filter trim) on write, so this function does not
 * repeat it.
 *
 * @private
 * @param {Object} config
 */
function updateDatasetConfig(config) {
updateActiveDatasetConfig(config);
}

/**
 * Set the preview-table row count. Write-only: the committed change emits
 * `PREVIEW_ROWS_CHANGED`, whose subscription repaints the workspace region.
 * Invalid values are ignored (`setPreviewRows` throws when `rows < 1`), so they
 * emit nothing and trigger no render.
 *
 * @private
 * @param {number} rows
 */
function updatePreviewRows(rows) {
	try {
		setPreviewRows(rows);
	} catch {
		// Ignore invalid values and preserve current preview state.
	}
}

// =============================================================================
// DOM ready: start app
// =============================================================================

function bootstrap() {
	initializeApplication().catch(reportInitializationError);
}

if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', bootstrap);
} else {
bootstrap();
}

// Debugging surface exposed on `window.chiveDebug`. NOT a stable API,
// production code must not depend on these handles. Useful from the
// browser console for poking at state + toggling the in-memory state log.
window.chiveDebug = {
getState,
getStateSummary,
getActiveDataset,
getLoadedDatasets,
updateDatasetColumns,
updateDatasetConfig,
switchTab,
refreshView: runFullRefreshNow,
showFeedback: showFeedbackMessage,
showError: showErrorMessage,
enableStateLog,
disableStateLog,
getStateLog,
clearStateLog,
};
