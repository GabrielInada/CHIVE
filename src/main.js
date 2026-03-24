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

import { initializeI18n, t } from './services/index.js';
import { PREVIEW_DEFAULT_ROWS } from './config/limits.js';
import {
renderEmptyState,
renderDataInterface,
renderFileList,
} from './components/index.js';
import { initChartControls, renderChartControlsSidebar } from './features/chartFeatures/index.js';
import { mergeChartConfigWithDefaults } from './config/chartDefaults.js';

import {
getState,
getActiveDataset,
onStateChange,
exposeGlobals,
initializeStateSync,
} from './modules/index.js';
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
initializeAllEventHandlers,
} from './modules/index.js';
import {
showFeedback,
showFeedbackMessage,
showError,
showErrorMessage,
hideErrorMessage,
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

// 2. Initialize state management
initializeStateSync();
exposeGlobals();

// 3. Initialize modules
initFileManager(handleDatasetsChanged);
initChartControls(handleChartConfigChanged);
initPanelManager(showFeedback);

// 4. Setup event handlers (must be after modules initialized)
initializeAllEventHandlers();

// 5. Setup UI subscriptions
setupStateSubscriptions();

// 6. Initial view render
refreshView();

// 7. Re-render dynamic content on locale changes
window.addEventListener('chive-locale-changed', () => {
refreshView();
});

// 8. Surface internal module errors in UI feedback
window.addEventListener('chive-internal-error', event => {
const message = event?.detail?.message || t('chive-error-internal');
showError(message);
});
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
 * Called when chart configuration changes
 */
function handleChartConfigChanged() {
refreshView();
}

/**
 * Subscribe to state changes and trigger UI updates
 */
function setupStateSubscriptions() {
// Re-render when active dataset changes
onStateChange('activeDataset', () => {
refreshView();
});

// Re-render when columns change
onStateChange('columnsUpdated', () => {
refreshView();
});

// Re-render when config changes
onStateChange('configUpdated', () => {
refreshView();
});
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
removeDatasetByIndex
);

// Render data preview and stats
if (dataset) {
	dataset.configGraficos = mergeChartConfigWithDefaults(dataset.configGraficos);
renderDataInterface(
dataset.dados,
dataset.colunas,
dataset.nome,
dataset.tamanho,
state.ui.previewRows,
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
 * Delegates to module
 */
function updateDatasetColumns(columns) {
const dataset = getActiveDataset();
if (dataset) {
dataset.colunasSelecionadas = columns;
refreshView();
}
}

/**
 * Update dataset chart configuration
 * Delegates to module
 */
function updateDatasetConfig(config) {
const dataset = getActiveDataset();
if (dataset) {
	dataset.configGraficos = mergeChartConfigWithDefaults({
		...dataset.configGraficos,
		...config,
	});
refreshView();
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
};
