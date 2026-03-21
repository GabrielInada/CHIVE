/**
 * CHIVE (Connected Hierarchical Interactive Visualization Engine)
 * Main Application Orchestrator
 * 
 * This refactored main.js coordinates all modularized components:
 * - appState: Centralized state management
 * - Modules: panelManager, chartControls, uiManager, fileManager, eventHandlers, feedbackUI
 * - Services: dataService, i18nService
 * - Components: resultsView
 * 
 * Architecture:
 * - All state in appState module
 * - Event coordination in eventHandlers module
 * - UI rendering delegated to specialized modules
 * - Main.js handles initialization and orchestration only
 */

import { inicializarI18n, t } from './services/i18nService.js';
import { PREVIEW_DEFAULT_ROWS } from './config/index.js';
import {
renderizarEstadoVazio,
renderizarInterface,
renderizarListaArquivos,
} from './components/resultsView.js';

// Module imports
import {
getState,
getActiveDataset,
onStateChange,
exposeGlobals,
} from './modules/appState.js';
import { initializeStateSync } from './modules/stateSync.js';
import {
initPanelManager,
initializeLayoutSelector,
renderSidebarPanel,
renderCanvasPanel,
} from './modules/panelManager.js';
import { initChartControls, renderChartControlsSidebar } from './modules/chartControls.js';
import { initFileManager, getLoadedDatasets, selectDataset, removeDatasetByIndex } from './modules/fileManager.js';
import { initializeAllEventHandlers } from './modules/eventHandlers.js';
import { showFeedback, mostrarFeedback, showError, mostrarErro, esconderErro } from './modules/feedbackUI.js';
import { switchTab } from './modules/uiManager.js';

// =============================================================================
// APPLICATION INITIALIZATION
// =============================================================================

/**
 * Master initialization function
 * Called once when DOM is ready
 */
async function initializeApplication() {
// 1. Initialize i18n system
await inicializarI18n();

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
atualizarVisao();

// 7. Re-render dynamic content on locale changes
window.addEventListener('chive-locale-changed', () => {
atualizarVisao();
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
atualizarVisao();
}

/**
 * Called when chart configuration changes
 */
function handleChartConfigChanged() {
atualizarVisao();
}

/**
 * Subscribe to state changes and trigger UI updates
 */
function setupStateSubscriptions() {
// Re-render when active dataset changes
onStateChange('activeDataset', () => {
atualizarVisao();
});

// Re-render when columns change
onStateChange('columnsUpdated', () => {
atualizarVisao();
});

// Re-render when config changes
onStateChange('configUpdated', () => {
atualizarVisao();
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
function atualizarVisao() {
const state = getState();
const datasets = getLoadedDatasets();
const activeIndex = state.data.activeIndex;
const dataset = getActiveDataset();

// Handle empty state
if (datasets.length === 0) {
renderizarEstadoVazio();
renderSidebarPanel();
renderCanvasPanel();
switchTab('preview');
return;
}

// Render datasets list
renderizarListaArquivos(
datasets,
activeIndex,
selectDataset,
removeDatasetByIndex
);

// Render data preview and stats
if (dataset) {
renderizarInterface(
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
atualizarVisao();
}
}

/**
 * Update dataset chart configuration
 * Delegates to module
 */
function updateDatasetConfig(config) {
const dataset = getActiveDataset();
if (dataset) {
dataset.configGraficos = {
...dataset.configGraficos,
...config,
};
atualizarVisao();
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
atualizarVisao,
showFeedback: mostrarFeedback,
showError: mostrarErro,
};
