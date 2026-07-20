/**
 * Small lifecycle adapter around the native modal dialog API.
 *
 * The browser owns top-layer ordering, focus containment, Escape handling,
 * background inertness, and scroll blocking. This adapter only centralizes the
 * behavior CHIVE still owns: backdrop dismissal, DOM cleanup, and focus return.
 */

/**
 * Append and show a modal dialog.
 *
 * Keep the visible surface as a child of `dialog`. A click retargeted from
 * `::backdrop` has the dialog itself as its target, while clicks inside the
 * surface target that child or one of its descendants.
 *
 * @param {HTMLDialogElement} dialog
 * @param {{ onDismiss?: () => void }} [options]
 * @returns {{ close: (returnValue?: string) => void }}
 */
export function showNativeModal(dialog, { onDismiss } = {}) {
	if (!(dialog instanceof window.HTMLDialogElement)) {
		throw new TypeError('showNativeModal requires an HTMLDialogElement');
	}

	const previousFocus = document.activeElement instanceof HTMLElement
		? document.activeElement
		: null;
	let closed = false;

	const dismiss = () => {
		if (!closed && typeof onDismiss === 'function') onDismiss();
	};
	const onCancel = event => {
		event.preventDefault();
		dismiss();
	};
	const onBackdropClick = event => {
		if (event.target === dialog) dismiss();
	};

	dialog.addEventListener('cancel', onCancel);
	dialog.addEventListener('click', onBackdropClick);
	document.body.appendChild(dialog);
	dialog.showModal();

	return {
		close(returnValue = '') {
			if (closed) return;
			closed = true;
			dialog.removeEventListener('cancel', onCancel);
			dialog.removeEventListener('click', onBackdropClick);
			if (dialog.open) dialog.close(returnValue);
			dialog.remove();
			if (previousFocus?.isConnected) {
				previousFocus.focus({ preventScroll: true });
			}
		},
	};
}

/**
 * @returns {boolean} Whether any modal dialog is currently open.
 */
export function isAnyDialogOpen() {
	return document.querySelector('dialog[open]') !== null;
}
