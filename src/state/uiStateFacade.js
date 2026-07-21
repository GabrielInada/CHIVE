import { STATE_EVENTS } from './stateEvents.js';
import { PREVIEW_MAX_ROWS, PREVIEW_MIN_ROWS } from '../config/limits.js';

/**
 * CHIVE UI-domain facade.
 *
 * Owns the reads and writes for `appState.ui`. Re-exported through `appState.js`,
 * call those wrappers, not these methods, from outside this module.
 *
 * @typedef {import('../types.js').SidebarMode} SidebarMode
 *
 * @see docs/development/architecture.md
 * @see CONTRIBUTING.md "Architecture invariants, do not break"
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
 *   getPreviewRows: () => number,
 * }}
 */
export function createUiStateFacade({ appState, emitStateChange }) {
	/**
	 * Switch the sidebar mode. No-op when the requested mode is already active.
	 *
	 * @param {SidebarMode} mode
	 * @throws {Error} When `mode` is not one of `'data' | 'viz' | 'panel'`.
	 * @fires STATE_EVENTS.SIDEBAR_MODE_CHANGED
	 */
	function setSidebarMode(mode) {
		if (!['data', 'viz', 'panel'].includes(mode)) {
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
	 * @param {number} rows - Integer in `[1, 1000]`.
	 * @throws {Error} When `rows` is not an integer in the supported range.
	 * @fires STATE_EVENTS.PREVIEW_ROWS_CHANGED - Only when the value changes.
	 */
	function setPreviewRows(rows) {
		if (!Number.isInteger(rows) || rows < PREVIEW_MIN_ROWS || rows > PREVIEW_MAX_ROWS) {
			throw new Error(`Preview rows must be an integer from ${PREVIEW_MIN_ROWS} to ${PREVIEW_MAX_ROWS}`);
		}
		if (appState.ui.previewRows === rows) return;
		appState.ui.previewRows = rows;
		emitStateChange(STATE_EVENTS.PREVIEW_ROWS_CHANGED, rows);
	}

	/**
	 * @returns {number} Current preview-table row count.
	 */
	function getPreviewRows() {
		return appState.ui.previewRows;
	}

	return {
		setSidebarMode,
		setPreviewRows,
		getPreviewRows,
	};
}
