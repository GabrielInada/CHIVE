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
 *   5. Subscribe a microtask-coalesced `scheduleRefreshView` to the
 *      ACTIVE_DATASET, DATASET_ADDED, DATASET_REMOVED, COLUMNS_UPDATED,
 *      CONFIG_UPDATED, and STATE_HYDRATED state events.
 *   6. Enable debounced auto-save.
 *   7. Initial render.
 *   8. Re-render on locale changes.
 *   9. Surface internal module errors via feedback toast.
 *
 * @typedef {import('./types.js').AppState} AppState
 */

import { initializeI18n, t } from './services/index.js';
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
} from './components/index.js';
import { initChartControls, renderChartControlsSidebar, renderCharts } from './features/chartFeatures.js';
import { mergeChartConfigWithDefaults } from './config/chartDefaults.js';
import { getNumericColumns } from './utils/columnHelpers.js';
import { rehydratePanelChartSpecs } from './utils/panelHydration.js';
import { throttle } from './utils/throttle.js';

import {
getState,
getPersistenceSnapshot,
getActiveDataset,
onStateChange,
STATE_EVENTS,
setPreviewRows,
normalizeActiveDatasetConfig,
updateActiveDatasetColumns,
updateActiveDatasetConfig,
replaceAllState,
} from './modules/index.js';
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
} from './modules/index.js';
import {
initFileManager,
getLoadedDatasets,
selectDataset,
removeDatasetByIndex,
handleJoinDatasetRequest,
handlePresetDatasetRequest,
initializeAllEventHandlers,
} from './modules/index.js';
import {
showFeedback,
showFeedbackMessage,
showError,
showErrorMessage,
switchTab,
} from './modules/index.js';

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
refreshView();

// 8. Re-render dynamic content on locale changes
window.addEventListener('chive-locale-changed', () => {
refreshView();
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

// Coalesces refreshView() across a synchronous burst of state events so e.g. an
// add-then-select (DATASET_ADDED + ACTIVE_DATASET in the same tick) paints once.
let refreshQueued = false;

/**
 * Schedule a coalesced `refreshView()` on the next microtask. Multiple calls in
 * the same tick collapse into a single render. The `queued` flag is cleared
 * before running so a thrown render cannot permanently wedge future schedules;
 * a render error is reported via the `chive-internal-error` channel (surfaced as
 * a toast) rather than escaping as an unhandled microtask rejection.
 *
 * @private
 */
function scheduleRefreshView() {
	if (refreshQueued) return;
	refreshQueued = true;
	Promise.resolve().then(() => {
		refreshQueued = false;
		try {
			refreshView();
		} catch (err) {
			window.dispatchEvent(new CustomEvent('chive-internal-error', {
				detail: { type: 'refresh-error', message: String(err?.message || err) },
			}));
		}
	});
}

/**
 * Subscribe the coalesced `scheduleRefreshView` to the state events whose
 * payloads affect what's rendered: dataset add/remove/select, columns, config,
 * and runtime imports (hydration).
 *
 * @private
 */
function setupStateSubscriptions() {
onStateChange(STATE_EVENTS.ACTIVE_DATASET, scheduleRefreshView);
onStateChange(STATE_EVENTS.DATASET_ADDED, scheduleRefreshView);
onStateChange(STATE_EVENTS.DATASET_REMOVED, scheduleRefreshView);
onStateChange(STATE_EVENTS.COLUMNS_UPDATED, scheduleRefreshView);
onStateChange(STATE_EVENTS.CONFIG_UPDATED, scheduleRefreshView);
onStateChange(STATE_EVENTS.STATE_HYDRATED, scheduleRefreshView);
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
 * `change` (commit) event re-renders the panel through the normal
 * CONFIG_UPDATED → refreshView path, still from the frozen snapshot.
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
 * Master view update. Reads state via getters, normalizes the active
 * dataset's config in place via {@link normalizeActiveDatasetConfig}
 * (no-emit by design, emitting would re-enter via CONFIG_UPDATED and
 * loop), then delegates rendering to specialized modules.
 *
 * Invoked through {@link scheduleRefreshView} by the state subscriptions
 * (dataset add/remove/select, columns, config, hydration), and called directly
 * for non-bus renders: boot, locale changes, and preview-row changes.
 *
 * @private
 */
function refreshView() {
const state = getState();
const datasets = getLoadedDatasets();
const activeIndex = state.data.activeIndex;
const dataset = getActiveDataset();

// Handle empty state
if (datasets.length === 0) {
renderFileList(
datasets,
activeIndex,
selectDataset,
removeDatasetByIndex,
handleJoinDatasetRequest,
handlePresetDatasetRequest
);
renderEmptyState();
renderSidebarPanel();
renderCanvasPanel();
switchTab('preview');
return;
}

// Render datasets list
renderFileList(
datasets,
activeIndex,
selectDataset,
removeDatasetByIndex,
handleJoinDatasetRequest,
handlePresetDatasetRequest
);

// Render data preview and stats
if (dataset) {
	normalizeActiveDatasetConfig(mergeChartConfigWithDefaults);
renderDataInterface(
dataset.rows,
dataset.columns,
dataset.name,
dataset.sizeLabel,
state.ui.previewRows,
updatePreviewRows,
dataset.selectedColumns,
updateDatasetColumns,
dataset.chartConfig,
updateDatasetConfig
);

// Render visualization controls
renderChartControlsSidebar(dataset);
}

// Render panel UI
initializeLayoutSelector();
renderSidebarPanel();
renderCanvasPanel();
}

/**
 * Apply a column-selection change. Delegates to the data facade; the
 * COLUMNS_UPDATED subscription drives `refreshView` automatically.
 *
 * @private
 * @param {string[]} columns
 */
function updateDatasetColumns(columns) {
updateActiveDatasetColumns(columns);
}

/**
 * Apply a chart-config change. Delegates to the data facade; the
 * CONFIG_UPDATED subscription drives `refreshView`. The merge-with-
 * defaults step lives in `refreshView`'s normalize-on-read path
 * ({@link normalizeActiveDatasetConfig}), so this function does not
 * repeat it.
 *
 * @private
 * @param {Object} config
 */
function updateDatasetConfig(config) {
updateActiveDatasetConfig(config);
}

/**
 * Set the preview-table row count. Invalid values are ignored
 * (`setPreviewRows` throws when `rows < 1`).
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
	refreshView();
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
refreshView,
showFeedback: showFeedbackMessage,
showError: showErrorMessage,
enableStateLog,
disableStateLog,
getStateLog,
clearStateLog,
};
