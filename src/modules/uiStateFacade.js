import { STATE_EVENTS } from './stateEvents.js';

/**
 * CHIVE UI-domain facade.
 *
 * Owns every write into `appState.ui`. Re-exported through `appState.js` —
 * call those wrappers, not these methods, from outside this module.
 *
 * @typedef {import('../types.js').SidebarMode} SidebarMode
 *
 * @see ARCHITECTURE.md
 * @see CONTRIBUTING.md "Architecture invariants — do not break"
 */

/**
 * Build the UI-domain facade.
 *
 * @param {Object} deps
 * @param {import('../types.js').AppState} deps.appState
 * @param {(eventType: import('../types.js').StateEventType, data?: *) => void} deps.emitStateChange
 * @returns {{
 *   setSidebarMode: (mode: SidebarMode) => void,
 *   setPreviewRows: (rows: number) => void,
 * }}
 */
export function createUiStateFacade({ appState, emitStateChange }) {
	/**
	 * Switch the sidebar mode. No-op when the requested mode is already active.
	 *
	 * @param {SidebarMode} mode
	 * @throws {Error} When `mode` is not one of `'dados' | 'viz' | 'panel'`.
	 * @fires STATE_EVENTS.SIDEBAR_MODE_CHANGED
	 */
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

	/**
	 * Set the preview-table row count.
	 *
	 * @param {number} rows - Must be ≥ 1.
	 * @throws {Error} When `rows < 1`.
	 * @fires STATE_EVENTS.PREVIEW_ROWS_CHANGED
	 */
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
