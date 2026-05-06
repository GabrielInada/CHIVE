/**
 * CHIVE (Connected Hierarchical Interactive Visualization Engine)
 * Main Application Orchestrator
 * 
 * This refactored main.js coordinates all modularized components:
 * - appState: Centralized state management
 * - Modules: panelManager, uiManager, fileManager, eventHandlers, feedbackUI
 * - Features: chartFeatures
 * - Services: dataService, i18nService
 * - Components: resultsView
 * 
 * Architecture:
 * - All state in appState module
 * - Event coordination in eventHandlers module
 * - UI rendering delegated to specialized modules
 * - Main.js handles initialization and orchestration only
 */

import { initializeI18n, t, processData } from './services/index.js';
import {
	isPersistenceAvailable,
	hydrateState,
	enablePersistenceAutoSave,
} from './services/persistenceService.js';
import { ingestFile, progressLabelForStage } from './services/dataIngestService.js';
import { PREVIEW_DEFAULT_ROWS } from './config/limits.js';
import {
renderEmptyState,
renderDataInterface,
renderFileList,
} from './components/index.js';
import { initChartControls, renderChartControlsSidebar, renderCharts } from './features/chartFeatures/index.js';
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
getDirtyDatasetIds,
clearDirtyDatasetIds,
} from './modules/index.js';
import {
enableStateLog,
disableStateLog,
getStateLog,
clearStateLog,
} from './modules/stateEvents.js';
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
 * Master initialization function
 * Called once when DOM is ready
 */
async function initializeApplication() {
// 1. Initialize i18n system
await initializeI18n();

// Only run app logic on pages that have the main app UI
if (!document.getElementById('info-arquivo')) return;

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
//    getDiff/clearDiff thread per-dataset dirty tracking through so the
//    save writes only changed dataset records (huge win for 200k-row datasets
//    where the old "clear + put all" path rewrote ~30 MB on every config tweak).
const persistenceHandle = enablePersistenceAutoSave(getState, {
	getDiff: getDirtyDatasetIds,
	clearDiff: clearDirtyDatasetIds,
});
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
 * Re-merge each persisted chart spec against the current chart defaults so
 * old specs absorb any new keys added to chartDefaults.js since they were
 * saved. Cheap; runs once on hydration.
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
 * Called when datasets list changes (added/removed)
 */
function handleDatasetsChanged() {
refreshView();
}

/**
 * Subscribe to state changes and trigger UI updates
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
 * Re-render only the chart visualizations using the current in-memory dataset
 * config. Called during live previews (e.g. while a color picker is open) so
 * the chart updates as the user drags, without rebuilding the controls sidebar
 * — which would steal focus from the picker.
 */
function livePreviewRender() {
	const dataset = getActiveDataset();
	if (!dataset || !Array.isArray(dataset.colunas)) return;
	const columnNames = dataset.colunas.map(column => column.nome);
	const selectedNames = new Set(
		Array.isArray(dataset.colunasSelecionadas)
			? dataset.colunasSelecionadas
			: columnNames
	);
	const visibleColumns = dataset.colunas.filter(column => selectedNames.has(column.nome));
	const visibleNumericColumns = getNumericColumns(visibleColumns);
	renderCharts(dataset.configGraficos, dataset.dados, visibleColumns, visibleNumericColumns);
	renderCanvasPanel();
}

// =============================================================================
// MASTER VIEW UPDATE ORCHESTRATOR
// =============================================================================

/**
 * Master view update function
 * Orchestrates all UI rendering based on current state
 * Called after any state change or user action
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
dataset.dados,
dataset.colunas,
dataset.nome,
dataset.tamanho,
state.ui.previewRows,
updatePreviewRows,
dataset.colunasSelecionadas,
updateDatasetColumns,
dataset.configGraficos,
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
 * Update dataset column selection
 * Delegates to facade; the COLUMNS_UPDATED subscription drives refreshView.
 */
function updateDatasetColumns(columns) {
updateActiveDatasetColumns(columns);
}

/**
 * Update dataset chart configuration
 * Delegates to facade; the CONFIG_UPDATED subscription drives refreshView.
 * The merge-with-defaults step lives in refreshView's normalize-on-read path
 * (normalizeActiveDatasetConfig), so we don't repeat it here.
 */
function updateDatasetConfig(config) {
updateActiveDatasetConfig(config);
}

function updatePreviewRows(rows) {
	try {
		setPreviewRows(rows);
	} catch {
		// Ignore invalid values and preserve current preview state.
	}
	refreshView();
}

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

async function loadPresetSource(preset) {
	if (Array.isArray(preset?.data)) {
		return { mode: 'inline', rows: preset.data, dropColumns: preset.dropColumns || [] };
	}

	if (typeof preset?.dataUrl !== 'string' || !preset.dataUrl.trim()) {
		throw new Error('preset-data-missing');
	}

	const response = await fetch(preset.dataUrl);
	if (!response.ok) {
		throw new Error(`preset-fetch-failed:${response.status}`);
	}

	const rawText = await response.text();
	const format = String(preset.dataFormat || '').toLowerCase();
	const kind = format === 'json' || preset.dataUrl.toLowerCase().endsWith('.json') ? 'json' : 'csv';
	return { mode: 'fetched', kind, text: rawText, dropColumns: preset.dropColumns || [] };
}

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
		const source = await loadPresetSource(preset);

		let dados;
		let colunas;
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
			dados = processed.dados;
			colunas = processed.colunas;
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

			({ dados, colunas, statsNumeric, statsCategorical } = result.value);
		}

		const dataset = {
			nome: presetName,
			tamanho: t('chive-preset-generated-size', [preset.rows]),
			dados,
			colunas,
			colunasSelecionadas: colunas.map(c => c.nome),
			configGraficos: createDefaultChartConfig(),
			precomputedStats: { numeric: statsNumeric, categorical: statsCategorical },
		};

		const index = addDataset(dataset);
		selectDataset(index);
		progress.succeed(t('chive-preset-load-success', [presetName]));
		refreshView();
	} catch (err) {
		progress.fail(t('chive-progress-failed', [err?.message || 'error']));
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

// Expose key functions to window for debugging/testing
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
