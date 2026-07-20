/**
 * Reusable, non-blocking confirmation dialog.
 */

import { showNativeModal } from './nativeDialog.js';

let confirmDialogId = 0;

/**
 * @param {Object} options
 * @param {string} options.title
 * @param {string} options.message
 * @param {string} options.confirmLabel
 * @param {string} options.cancelLabel
 * @returns {Promise<boolean>}
 */
export function openConfirmDialog({
	title,
	message,
	confirmLabel,
	cancelLabel,
}) {
	return new Promise(resolve => {
		const instanceId = ++confirmDialogId;
		const dialog = document.createElement('dialog');
		dialog.className = 'app-dialog';
		dialog.setAttribute('aria-labelledby', `confirm-dialog-title-${instanceId}`);
		dialog.setAttribute('aria-describedby', `confirm-dialog-message-${instanceId}`);

		const surface = document.createElement('form');
		surface.method = 'dialog';
		surface.className = 'confirm-dialog';

		const heading = document.createElement('h3');
		heading.id = `confirm-dialog-title-${instanceId}`;
		heading.className = 'confirm-dialog-title';
		heading.textContent = title;
		surface.appendChild(heading);

		const body = document.createElement('p');
		body.id = `confirm-dialog-message-${instanceId}`;
		body.className = 'confirm-dialog-message';
		body.textContent = message;
		surface.appendChild(body);

		const actions = document.createElement('div');
		actions.className = 'confirm-dialog-actions';

		const cancelButton = document.createElement('button');
		cancelButton.type = 'button';
		cancelButton.className = 'btn-secondary';
		cancelButton.autofocus = true;
		cancelButton.textContent = cancelLabel;

		const confirmButton = document.createElement('button');
		confirmButton.type = 'button';
		confirmButton.className = 'btn-primary';
		confirmButton.textContent = confirmLabel;

		actions.appendChild(cancelButton);
		actions.appendChild(confirmButton);
		surface.appendChild(actions);
		dialog.appendChild(surface);

		let settled = false;
		const finish = confirmed => {
			if (settled) return;
			settled = true;
			lifecycle.close(confirmed ? 'confirm' : 'cancel');
			resolve(confirmed);
		};

		cancelButton.addEventListener('click', () => finish(false));
		confirmButton.addEventListener('click', () => finish(true));
		const lifecycle = showNativeModal(dialog, {
			onDismiss: () => finish(false),
		});
	});
}
