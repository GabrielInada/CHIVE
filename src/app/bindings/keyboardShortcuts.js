/**
 * CHIVE global keyboard shortcuts workflow.
 *
 * Ctrl/Cmd+O opens the file picker, unless a control already consumed the event
 * or a modal dialog is open.
 */

import { isAnyDialogOpen } from '../../ui/dialogFocus.js';
import { FILE_IDS } from '../../features/datasetWorkspace/domIds.js';

let keyboardListenersReady = false;

/**
 * Internal workflow setup, called by `app/domBindings.js`.
 * Wires the global keyboard shortcuts. Safe to call more than once: the global
 * listener registers only on the first call.
 */
export function setupGlobalKeyboardListeners() {
	if (keyboardListenersReady) return;
	document.addEventListener('keydown', onGlobalKeydown);
	keyboardListenersReady = true;
}

/** @private */
function onGlobalKeydown(event) {
	// Let a focused control (e.g. an open dialog's Tab trap) suppress global
	// shortcuts by consuming the event first.
	if (event.defaultPrevented) return;
	// Ctrl+O or Cmd+O: open file picker
	if ((event.ctrlKey || event.metaKey) && event.key === 'o') {
		event.preventDefault();
		// Never open the picker behind an open modal dialog.
		if (isAnyDialogOpen()) return;
		document.getElementById(FILE_IDS.fileInput)?.click();
	}
}
