// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { openConfirmDialog } from '../../src/ui/confirmDialog.js';

const options = {
	title: 'Replace project?',
	message: 'Current work will be replaced.',
	confirmLabel: 'Continue',
	cancelLabel: 'Cancel',
};

describe('openConfirmDialog', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('renders an accessible native dialog and resolves true on confirmation', async () => {
		const pending = openConfirmDialog(options);
		const dialog = document.querySelector('dialog[open]');

		expect(dialog).not.toBeNull();
		expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
		expect(dialog.getAttribute('aria-describedby')).toBeTruthy();
		expect(document.querySelector('.confirm-dialog-title').textContent).toBe(options.title);
		expect(document.querySelector('.confirm-dialog-message').textContent).toBe(options.message);

		Array.from(document.querySelectorAll('.confirm-dialog-actions button'))
			.find(button => button.textContent === 'Continue')
			.click();

		await expect(pending).resolves.toBe(true);
		expect(document.querySelector('dialog')).toBeNull();
	});

	it('resolves false on cancel, Escape, and backdrop dismissal', async () => {
		let pending = openConfirmDialog(options);
		Array.from(document.querySelectorAll('.confirm-dialog-actions button'))
			.find(button => button.textContent === 'Cancel')
			.click();
		await expect(pending).resolves.toBe(false);

		pending = openConfirmDialog(options);
		document.querySelector('dialog').dispatchEvent(new Event('cancel', { cancelable: true }));
		await expect(pending).resolves.toBe(false);

		pending = openConfirmDialog(options);
		document.querySelector('dialog').click();
		await expect(pending).resolves.toBe(false);
	});
});
