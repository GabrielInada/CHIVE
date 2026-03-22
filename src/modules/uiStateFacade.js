export function createUiStateFacade({ appState, emitStateChange }) {
	function getSidebarMode() {
		return appState.ui.sidebarMode;
	}

	function setSidebarMode(mode) {
		if (!['dados', 'viz', 'panel'].includes(mode)) {
			throw new Error(`Invalid sidebar mode: ${mode}`);
		}
		if (appState.ui.sidebarMode === mode) {
			return;
		}
		appState.ui.sidebarMode = mode;
		emitStateChange('sidebarModeChanged', mode);
	}

	function getExpandedCharts() {
		return appState.ui.expandedCharts;
	}

	function setChartExpanded(chartName, expanded) {
		appState.ui.expandedCharts[chartName] = expanded;
		emitStateChange('chartExpandedChanged', { chartName, expanded });
	}

	function getPreviewRows() {
		return appState.ui.previewRows;
	}

	function setPreviewRows(rows) {
		if (rows < 1) throw new Error('Preview rows must be >= 1');
		appState.ui.previewRows = rows;
		emitStateChange('previewRowsChanged', rows);
	}

	return {
		getSidebarMode,
		setSidebarMode,
		getExpandedCharts,
		setChartExpanded,
		getPreviewRows,
		setPreviewRows,
	};
}
