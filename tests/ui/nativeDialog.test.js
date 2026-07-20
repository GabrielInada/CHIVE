// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { showNativeModal } from '../../src/ui/nativeDialog.js';

function createDialog() {
	const dialog = document.createElement('dialog');
	const surface = document.createElement('div');
	surface.className = 'surface';
	dialog.appendChild(surface);
	return { dialog, surface };
}

describe('showNativeModal', () => {
	beforeEach(() => {
		document.body.innerHTML = '<button id="trigger" type="button">Open</button>';
	});

	it('opens in the native top layer and restores focus on close', () => {
		const trigger = document.getElementById('trigger');
		trigger.focus();
		const { dialog } = createDialog();

		const lifecycle = showNativeModal(dialog);
		expect(dialog.open).toBe(true);
		expect(dialog.isConnected).toBe(true);

		lifecycle.close('done');
		expect(dialog.isConnected).toBe(false);
		expect(document.activeElement).toBe(trigger);
	});

	it('routes cancel and backdrop clicks through the dismiss callback', () => {
		const onDismiss = vi.fn();
		const { dialog, surface } = createDialog();
		showNativeModal(dialog, { onDismiss });

		const cancel = new Event('cancel', { cancelable: true });
		dialog.dispatchEvent(cancel);
		expect(cancel.defaultPrevented).toBe(true);
		expect(onDismiss).toHaveBeenCalledTimes(1);

		surface.click();
		expect(onDismiss).toHaveBeenCalledTimes(1);
		dialog.click();
		expect(onDismiss).toHaveBeenCalledTimes(2);
	});

	it('makes close idempotent', () => {
		const { dialog } = createDialog();
		const closeSpy = vi.spyOn(dialog, 'close');
		const lifecycle = showNativeModal(dialog);

		lifecycle.close();
		lifecycle.close();

		expect(closeSpy).toHaveBeenCalledTimes(1);
	});
});
