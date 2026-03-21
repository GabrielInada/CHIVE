/**
 * CHIVE State Synchronization
 * 
 * Bridges appState mutations with UI updates and global object sync.
 * Coordinates state changes across the application.
 */

import {
	getState,
	getActiveDataset,
	getAllDatasets,
	onStateChange,
	updateActiveDatasetConfig,
	updateActiveDatasetColumns,
	setSidebarMode,
	exposeGlobals,
} from './appState.js';

/**
 * Initialize state synchronization
 * Sets up listeners for state changes and performs initial sync
 */
export function initializeStateSync() {
	// Sync globals whenever state changes
	onStateChange('*', () => {
		syncWindowGlobals();
	});
	
	// Initial sync
	syncWindowGlobals();
}

/**
 * Synchronize app state to window globals for backwards compatibility
 * Call this after any state mutation
 */
export function syncWindowGlobals() {
	exposeGlobals();
}

/**
 * Update active dataset column selection and trigger UI refresh
 * @param {Array<string>} columnNames - Selected column names
 */
export function updateActiveDatasetColumnSelection(columnNames) {
	updateActiveDatasetColumns(columnNames);
	// Caller will handle UI update via atualizarVisao()
}

/**
 * Update active dataset chart configuration and trigger UI refresh
 * @param {Object} configUpdates - Configuration updates to merge
 */
export function updateActiveDatasetChartConfig(configUpdates) {
	updateActiveDatasetConfig(configUpdates);
	// Caller will handle UI update via atualizarVisao()
}

/**
 * Switch to a sidebar mode and sync UI
 * @param {string} mode - 'dados' | 'viz' | 'panel'
 */
export function switchSidebarMode(mode) {
	setSidebarMode(mode);
	updateSidebarUI(mode);
}

/**
 * Update sidebar UI visibility based on current mode
 * Called by switchSidebarMode
 * @private
 * @param {string} mode - Current sidebar mode
 */
function updateSidebarUI(mode) {
	const dadosPanel = document.getElementById('sidebar-panel-dados');
	const vizPanel = document.getElementById('sidebar-panel-viz');
	const painelPanel = document.getElementById('sidebar-panel-panel');
	
	if (dadosPanel) dadosPanel.classList.toggle('ativo', mode === 'dados');
	if (vizPanel) vizPanel.classList.toggle('ativo', mode === 'viz');
	if (painelPanel) painelPanel.classList.toggle('ativo', mode === 'panel');
}

/**
 * Get formatted state summary for debugging
 * @returns {Object} State summary
 */
export function getStateSummary() {
	const state = getState();
	return {
		datasetsCount: state.data.datasets.length,
		activeDatasetIndex: state.data.activeIndex,
		activeDatasetName: getActiveDataset()?.nome || 'none',
		panelChartsCount: state.panel.charts.length,
		panelLayout: state.panel.layout,
		sidebarMode: state.ui.sidebarMode,
		expandedCharts: state.ui.expandedCharts,
	};
}

/**
 * Return current state debug payload without console output.
 */
export function debugLogState() {
	return {
		summary: getStateSummary(),
		state: getState(),
	};
}
