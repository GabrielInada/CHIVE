import { STATE_EVENTS } from './stateEvents.js';

export function createUiStateFacade({ appState, emitStateChange }) {
	function setSidebarMode(mode) {
		if (!['dados', 'viz', 'panel'].includes(mode)) {
			throw new Error(`Invalid sidebar mode: ${mode}`);
		}
		if (appState.ui.sidebarMode === mode) {
			return;
		}
		appState.ui.sidebarMode = mode;
		emitStateChange(STATE_EVENTS.SIDEBAR_MODE_CHANGED, mode);
	}

	function setPreviewRows(rows) {
		if (rows < 1) throw new Error('Preview rows must be >= 1');
		appState.ui.previewRows = rows;
		emitStateChange(STATE_EVENTS.PREVIEW_ROWS_CHANGED, rows);
	}

	return {
		setSidebarMode,
		setPreviewRows,
	};
}
