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
	STATE_EVENTS,
	updateActiveDatasetConfig,
	updateActiveDatasetColumns,
	setSidebarMode,
	exposeGlobals,
} from './appState.js';
import { updateSidebarUI } from './uiManager.js';

/**
 * Initialize state synchronization
 * Sets up listeners for state changes and performs initial sync
 */
export function initializeStateSync() {
	// Sync globals whenever state changes
	onStateChange(STATE_EVENTS.WILDCARD, () => {
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
	// Caller will handle UI update via refreshView()
}

/**
 * Update active dataset chart configuration and trigger UI refresh
 * @param {Object} configUpdates - Configuration updates to merge
 */
export function updateActiveDatasetChartConfig(configUpdates) {
	updateActiveDatasetConfig(configUpdates);
	// Caller will handle UI update via refreshView()
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
