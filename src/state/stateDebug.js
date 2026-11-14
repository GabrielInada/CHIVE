/**
 * CHIVE state debug helpers.
 *
 * Console-facing diagnostics exposed via `window.chiveDebug`. Not a stable
 * API; production code must not depend on these.
 *
 * @typedef {import('../types.js').SidebarMode} SidebarMode
 */

import { getPersistenceStateView } from './appState.js';

/**
 * Compact state digest for debugging from the browser console. Counts and
 * indices only, no dataset names or filenames, so the debug surface does
 * not echo uploaded data.
 *
 * @returns {{ datasetsCount: number, activeDatasetIndex: number, panelChartsCount: number, panelLayout: string, sidebarMode: SidebarMode }}
 */
export function getStateSummary() {
	// This view only assembles references. Read five scalars without cloning or
	// traversing any uploaded rows or chart snapshots.
	const state = getPersistenceStateView();
	return {
		datasetsCount: state.data.datasets.length,
		activeDatasetIndex: state.data.activeIndex,
		panelChartsCount: state.panel.charts.length,
		panelLayout: state.panel.layout,
		sidebarMode: state.ui.sidebarMode,
	};
}
