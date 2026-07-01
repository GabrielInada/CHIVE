/**
 * CHIVE global keyboard shortcuts workflow.
 *
 * Ctrl/Cmd+O opens the file picker, unless a control already consumed the event
 * or a modal dialog is open.
 */

import { isAnyDialogOpen } from '../dialogFocus.js';

/**
 * Internal workflow setup, called by `eventHandlers.js`.
 * Wires the global keyboard shortcuts.
 */
export function setupGlobalKeyboardListeners() {
	document.addEventListener('keydown', event => {
		// Let a focused control (e.g. an open dialog's Tab trap) suppress global
		// shortcuts by consuming the event first.
		if (event.defaultPrevented) return;
		// Ctrl+O or Cmd+O: open file picker
		if ((event.ctrlKey || event.metaKey) && event.key === 'o') {
			event.preventDefault();
			// Never open the picker behind an open modal dialog.
			if (isAnyDialogOpen()) return;
			document.getElementById('file-input')?.click();
		}
	});
}
