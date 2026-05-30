/**
 * CHIVE State Synchronization.
 *
 * Backwards-compatibility shim that mirrors `appState` into `window.*`
 * globals on every emission, plus a handful of pass-through wrappers for
 * legacy callers. New code should read state via the getters in
 * `appState.js` and write via the facade methods directly.
 *
 * @typedef {import('../../types.js').AppState} AppState
 * @typedef {import('../../types.js').SidebarMode} SidebarMode
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
import { updateSidebarUI } from '../uiManager.js';

/**
 * Subscribe wildcard to {@link syncWindowGlobals} and run an initial
 * sync. Called once during app boot from `main.js`. Wildcard
 * subscription is sanctioned for state-bus consumers, see
 * `docs/ARCHITECTURE_REFERENCE.md`.
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
 * Mirror app state to `window.*` globals via `appState.exposeGlobals`.
 * Invoked from the wildcard subscriber above.
 *
 * @deprecated Window-global mirroring is a backwards-compat shim. New code should read via the getters exported from {@link appState}.
 */
export function syncWindowGlobals() {
	exposeGlobals();
}

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
 * Compact state digest for debugging, feeds the `window.chiveDebug`
 * surface in `main.js`. Not a stable API.
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
