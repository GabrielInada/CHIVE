/**
 * CHIVE (Connected Hierarchical Interactive Visualization Engine)
 * — Main Application Orchestrator.
 *
 * Boot sequence (see {@link initializeApplication}):
 *   1. Initialize i18n (await — must precede any translated render).
 *   2. Hydrate persisted state from IndexedDB BEFORE wiring subscribers,
 *      so restoration does not trigger a redundant save and the first
 *      render sees the restored state.
 *   3. Initialize state sync + expose backwards-compat globals.
 *   4. Initialize fileManager / chartControls / panelManager.
 *   5. Wire global DOM listeners via `eventHandlers`.
 *   6. Subscribe `refreshView` to dataset/columns/config state events.
 *   7. Enable debounced auto-save; flush on `beforeunload`.
 *   8. Initial render.
 *   9. Re-render on locale changes.
 *   10. Surface internal module errors via feedback toast.
 *
 * @typedef {import('./types.js').AppState} AppState
 */

import { initializeI18n, t, processData } from './services/index.js';
import {
	isPersistenceAvailable,
	hydrateState,
	enablePersistenceAutoSave,
} from './services/persistenceService.js';
import { ingestFile, progressLabelForStage } from './services/dataIngestService.js';
import { loadPresetSource, PresetFetchTimeoutError } from './services/presetService.js';
import { PREVIEW_DEFAULT_ROWS } from './config/limits.js';
import {
renderEmptyState,
renderDataInterface,
renderFileList,
} from './components/index.js';
import { initChartControls, renderChartControlsSidebar, renderCharts } from './features/chartFeatures.js';
import { createDefaultChartConfig, mergeChartConfigWithDefaults } from './config/chartDefaults.js';
import { getNumericColumns } from './utils/columnHelpers.js';

import {
getState,
getActiveDataset,
onStateChange,
STATE_EVENTS,
exposeGlobals,
initializeStateSync,
setPreviewRows,
addDataset,
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
createJoinedDataset,
initializeAllEventHandlers,
} from './modules/index.js';
import {
showFeedback,
showFeedbackMessage,
showError,
showErrorMessage,
hideErrorMessage,
showProgress,
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

// 2. Hydrate persisted state BEFORE any subscriber (incl. stateSync) is wired,
//    so the act of restoring doesn't immediately schedule a redundant save and
//    refreshView sees the restored state on first paint.
if (isPersistenceAvailable()) {
	await hydrateState({
		replaceAllState,
		transformPanel: rehydratePanelChartSpecs,
	});
}

// 3. Initialize state management
initializeStateSync();
exposeGlobals();

// 4. Initialize modules
initFileManager(handleDatasetsChanged);
initChartControls(null, livePreviewRender);
initPanelManager(showFeedback);

// 5. Setup event handlers (must be after modules initialized)
initializeAllEventHandlers();

// 6. Setup UI subscriptions
setupStateSubscriptions();

// 7. Wire debounced auto-save AFTER subscriptions; flush on tab close so
//    the last in-flight change survives. enablePersistenceAutoSave skips
//    the STATE_HYDRATED event internally to avoid resaving the load.
const persistenceHandle = enablePersistenceAutoSave(getState);
window.addEventListener('beforeunload', () => persistenceHandle.flush());

// 8. Initial view render
refreshView();

// 9. Re-render dynamic content on locale changes
window.addEventListener('chive-locale-changed', () => {
refreshView();
});

// 10. Surface internal module errors in UI feedback
window.addEventListener('chive-internal-error', event => {
const message = event?.detail?.message || t('chive-error-internal');
showError(message);
});
}

/**
 * Re-merge each persisted chart spec against the current chart defaults
 * so old specs absorb any new keys added to `chartDefaults.js` since
 * they were saved. Cheap; runs once on hydration. Passed as the
 * `transformPanel` hook into `persistenceService.hydrateState`.
 *
 * @private
 * @param {Object} panel - Raw panel record from IndexedDB.
 * @returns {Object} Same shape with `charts` upgraded.
 */
function rehydratePanelChartSpecs(panel) {
	if (!panel || !Array.isArray(panel.charts)) return panel;
	const charts = panel.charts.map(spec => {
		if (!spec || !spec.type) return spec;
		const merged = mergeChartConfigWithDefaults({ [spec.type]: spec.config || {} });
		return { ...spec, config: merged[spec.type] };
	});
	return { ...panel, charts };
}

// =============================================================================
// STATE SUBSCRIPTIONS & CALLBACKS
// =============================================================================

/**
 * Callback fileManager invokes after any add/remove/select. Triggers a
 * full re-render.
 *
 * @private
 */
function handleDatasetsChanged() {
refreshView();
}

/**
 * Subscribe `refreshView` to the three state events whose payloads
 * affect what's rendered: active dataset, columns, and config.
 *
 * @private
 */
function setupStateSubscriptions() {
// Re-render when active dataset changes
onStateChange(STATE_EVENTS.ACTIVE_DATASET, () => {
refreshView();
});

// Re-render when columns change
onStateChange(STATE_EVENTS.COLUMNS_UPDATED, () => {
refreshView();
});

// Re-render when config changes
onStateChange(STATE_EVENTS.CONFIG_UPDATED, () => {
refreshView();
});

}

// =============================================================================
// LIVE PREVIEW RENDER (no controls re-render)
// =============================================================================

/**
 * Re-render only the chart visualizations using the current in-memory
 * dataset config. Called during live previews (e.g. while a color
 * picker is open) so the chart updates as the user drags, without
 * rebuilding the controls sidebar — which would steal focus from the
 * picker.
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
	renderCanvasPanel();
}

// =============================================================================
// MASTER VIEW UPDATE ORCHESTRATOR
// =============================================================================

/**
 * Master view update. Reads state via getters, normalizes the active
 * dataset's config in place via {@link normalizeActiveDatasetConfig}
 * (no-emit by design — emitting would re-enter via CONFIG_UPDATED and
 * loop), then delegates rendering to specialized modules.
 *
 * Called after any state change the file subscribes to (active dataset,
 * columns, config) and after explicit user actions like preset/join
 * imports.
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

// Sync window globals for backwards compatibility
exposeGlobals();
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

/**
 * Handle a join request from the dataset-list UI. Delegates to
 * `fileManager.createJoinedDataset`; on success, activates the new
 * dataset and shows a success toast. Failures surface as error toasts
 * with the translated message.
 *
 * @private
 * @param {Object} spec - Forwarded to `createJoinedDataset`.
 */
function handleJoinDatasetRequest(spec) {
	const result = createJoinedDataset(spec);
	if (!result?.ok) {
		showError(result?.message || t('chive-join-error-generic'));
		return;
	}

	selectDataset(result.index);
	showFeedback(t('chive-join-success', [result.datasetName]));
	refreshView();
}

/**
 * Handle a preset dataset request. Resolves the preset source (inline
 * or fetched), runs the ingest pipeline (worker for fetched / `processData`
 * sync for inline), and adds the resulting dataset. The progress toast
 * carries the cancellation signal for both the fetch and the worker.
 *
 * `PresetFetchTimeoutError` surfaces a dedicated timeout message;
 * everything else is reported as a generic join/preset error.
 *
 * @private
 * @param {import('./types.js').PresetDescriptor & { nameKey: string, rows: number }} preset
 */
async function handlePresetDatasetRequest(preset) {
	if (!preset) {
		showError(t('chive-join-error-generic'));
		return;
	}

	const presetName = t(preset.nameKey);
	const progress = showProgress(t('chive-progress-parsing', [presetName]));
	const abortController = new AbortController();
	progress.onCancel(() => abortController.abort());

	try {
		const source = await loadPresetSource(preset, { signal: abortController.signal });

		let rows;
		let columns;
		let statsNumeric = [];
		let statsCategorical = [];

		if (source.mode === 'inline') {
			// Inline presets are tiny demo arrays — sync processData is cheap.
			let rows = source.rows;
			if (source.dropColumns.length > 0) {
				const dropSet = new Set(source.dropColumns);
				rows = rows.map(row => {
					const next = { ...row };
					dropSet.forEach(key => { delete next[key]; });
					return next;
				});
			}
			const processed = processData(rows);
			rows = processed.rows;
			columns = processed.columns;
			progress.update(100);
		} else {
			const result = await ingestFile(
				{ kind: source.kind, text: source.text, options: { dropColumns: source.dropColumns } },
				{
					signal: abortController.signal,
					onProgress: ({ stage, percent }) => {
						progress.update(percent, progressLabelForStage(stage, presetName));
					},
				},
			);

			if (!result.ok) {
				if (result.reason === 'cancelled') progress.close();
				else progress.fail(t('chive-progress-failed', [result.reason]));
				return;
			}

			({ rows, columns, statsNumeric, statsCategorical } = result.value);
		}

		const dataset = {
			name: presetName,
			sizeLabel: t('chive-preset-generated-size', [preset.rows]),
			rows,
			columns,
			selectedColumns: columns.map(c => c.name),
			chartConfig: createDefaultChartConfig(),
			precomputedStats: { numeric: statsNumeric, categorical: statsCategorical },
		};

		const index = addDataset(dataset);
		selectDataset(index);
		progress.succeed(t('chive-preset-load-success', [presetName]));
		refreshView();
	} catch (err) {
		if (err instanceof PresetFetchTimeoutError) {
			progress.fail(t('chive-preset-fetch-timeout', [presetName]));
		} else {
			progress.fail(t('chive-progress-failed', [err?.message || 'error']));
		}
		showError(t('chive-join-error-generic'));
	}
}

// =============================================================================
// DOM READY - START APP
// =============================================================================

if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', initializeApplication);
} else {
initializeApplication();
}

// Debugging surface exposed on `window.chiveDebug`. NOT a stable API —
// production code must not depend on these handles. Useful from the
// browser console for poking at state + toggling the in-memory state log.
window.chiveDebug = {
getState,
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
