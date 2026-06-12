/**
 * CHIVE state compatibility wrappers.
 *
 * Deprecated pass-through wrappers kept for legacy callers, plus debug
 * state summaries. New code should read state via the getters in
 * `appState.js` and write via the facade methods directly.
 *
 * @typedef {import('../../types.js').AppState} AppState
 * @typedef {import('../../types.js').SidebarMode} SidebarMode
 */

import {
	getState,
	getActiveDataset,
	updateActiveDatasetConfig,
	updateActiveDatasetColumns,
	setSidebarMode,
} from './appState.js';
import { updateSidebarUI } from '../uiManager.js';

/**
 * @deprecated Call {@link updateActiveDatasetColumns} from `appState.js` directly.
 * @param {string[]} columnNames
 */
export function updateActiveDatasetColumnSelection(columnNames) {
	updateActiveDatasetColumns(columnNames);
	// Caller will handle UI update via refreshView()
}

/**
 * @deprecated Call {@link updateActiveDatasetConfig} from `appState.js` directly.
 * @param {Object} configUpdates
 */
export function updateActiveDatasetChartConfig(configUpdates) {
	updateActiveDatasetConfig(configUpdates);
	// Caller will handle UI update via refreshView()
}

/**
 * @deprecated Call {@link setSidebarMode} from `appState.js` followed by {@link updateSidebarUI} if a DOM refresh is needed.
 * @param {SidebarMode} mode
 */
export function switchSidebarMode(mode) {
	setSidebarMode(mode);
	updateSidebarUI(mode);
}

/**
 * Compact state digest for debugging from the browser console. Not a
 * stable API.
 *
 * @returns {{ datasetsCount: number, activeDatasetIndex: number, activeDatasetName: string, panelChartsCount: number, panelLayout: string, sidebarMode: SidebarMode }}
 */
export function getStateSummary() {
	const state = getState();
	return {
		datasetsCount: state.data.datasets.length,
		activeDatasetIndex: state.data.activeIndex,
		activeDatasetName: getActiveDataset()?.name || 'none',
		panelChartsCount: state.panel.charts.length,
		panelLayout: state.panel.layout,
		sidebarMode: state.ui.sidebarMode,
	};
}

/**
 * Return both {@link getStateSummary} and the full state as a debug
 * payload. Not a stable API.
 *
 * @returns {{ summary: ReturnType<getStateSummary>, state: AppState }}
 */
export function debugLogState() {
	return {
		summary: getStateSummary(),
		state: getState(),
	};
}
