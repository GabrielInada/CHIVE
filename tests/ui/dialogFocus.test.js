// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('dialogFocus', () => {
	let installDialogFocus;
	let isAnyDialogOpen;

	beforeEach(async () => {
		document.body.innerHTML = '';
		document.body.style.overflow = '';
		// Re-import to reset the module-level dialog stack between tests.
		vi.resetModules();
		const mod = await import('../../src/ui/dialogFocus.js');
		installDialogFocus = mod.installDialogFocus;
		isAnyDialogOpen = mod.isAnyDialogOpen;
	});

	// jsdom reports zero client rects for visible nodes, so stub visibility.
	const visible = () => true;

	function makeDialog(buttonLabels = ['a', 'b']) {
		const overlay = document.createElement('div');
		overlay.className = 'join-overlay';
		const dialog = document.createElement('div');
		dialog.className = 'join-dialog';
		buttonLabels.forEach(label => {
			const btn = document.createElement('button');
			btn.textContent = label;
			dialog.appendChild(btn);
		});
		overlay.appendChild(dialog);
		document.body.appendChild(overlay);
		return { overlay, dialog, buttons: Array.from(dialog.querySelectorAll('button')) };
	}

	function tab({ shift = false } = {}) {
		const event = new KeyboardEvent('keydown', {
			key: 'Tab',
			shiftKey: shift,
			bubbles: true,
			cancelable: true,
		});
		document.dispatchEvent(event);
		return event;
	}

	it('moves focus into the dialog on open (deferred to a microtask)', async () => {
		const { overlay, dialog, buttons } = makeDialog();
		installDialogFocus(overlay, dialog, { isVisible: visible });
		await Promise.resolve();
		expect(document.activeElement).toBe(buttons[0]);
	});

	it('honors an explicit initialFocus target', async () => {
		const { overlay, dialog, buttons } = makeDialog(['a', 'b', 'c']);
		installDialogFocus(overlay, dialog, { isVisible: visible, initialFocus: buttons[2] });
		await Promise.resolve();
		expect(document.activeElement).toBe(buttons[2]);
	});

	it('locks body scroll while open and restores it on release', () => {
		document.body.style.overflow = 'scroll';
		const { overlay, dialog } = makeDialog();
		const ctrl = installDialogFocus(overlay, dialog, { isVisible: visible });
		expect(document.body.style.overflow).toBe('hidden');
		ctrl.release();
		expect(document.body.style.overflow).toBe('scroll');
	});

	it('isAnyDialogOpen reflects open/closed state', () => {
		const { overlay, dialog } = makeDialog();
		expect(isAnyDialogOpen()).toBe(false);
		const ctrl = installDialogFocus(overlay, dialog, { isVisible: visible });
		expect(isAnyDialogOpen()).toBe(true);
		ctrl.release();
		expect(isAnyDialogOpen()).toBe(false);
	});

	it('traps Tab, wrapping from last focusable back to first', () => {
		const { overlay, dialog, buttons } = makeDialog(['a', 'b']);
		installDialogFocus(overlay, dialog, { isVisible: visible });
		buttons[1].focus();
		const event = tab();
		expect(event.defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(buttons[0]);
	});

	it('traps Shift+Tab, wrapping from first focusable to last', () => {
		const { overlay, dialog, buttons } = makeDialog(['a', 'b']);
		installDialogFocus(overlay, dialog, { isVisible: visible });
		buttons[0].focus();
		const event = tab({ shift: true });
		expect(event.defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(buttons[1]);
	});

	it('does not intercept a Tab in the middle of the focusables', () => {
		const { overlay, dialog, buttons } = makeDialog(['a', 'b', 'c']);
		installDialogFocus(overlay, dialog, { isVisible: visible });
		buttons[0].focus();
		const event = tab();
		expect(event.defaultPrevented).toBe(false);
	});

	it('lets Escape propagate (does not handle it)', () => {
		const { overlay, dialog } = makeDialog();
		installDialogFocus(overlay, dialog, { isVisible: visible });
		const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
		document.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(false);
	});

	it('restores focus to the trigger on close', async () => {
		const trigger = document.createElement('button');
		document.body.appendChild(trigger);
		trigger.focus();

		const { overlay, dialog } = makeDialog();
		const ctrl = installDialogFocus(overlay, dialog, { isVisible: visible });
		await Promise.resolve();
		expect(document.activeElement).not.toBe(trigger);

		ctrl.release();
		overlay.remove();
		ctrl.restoreFocus();
		expect(document.activeElement).toBe(trigger);
	});

	it('release and restoreFocus are idempotent', () => {
		const trigger = document.createElement('button');
		document.body.appendChild(trigger);
		trigger.focus();

		const { overlay, dialog } = makeDialog();
		const ctrl = installDialogFocus(overlay, dialog, { isVisible: visible });
		ctrl.release();
		ctrl.release();
		overlay.remove();
		ctrl.restoreFocus();
		ctrl.restoreFocus();

		expect(document.activeElement).toBe(trigger);
		expect(isAnyDialogOpen()).toBe(false);
	});

	it('ref-counts the scroll lock across two stacked dialogs', () => {
		const a = makeDialog();
		const b = makeDialog();
		const ctrlA = installDialogFocus(a.overlay, a.dialog, { isVisible: visible });
		const ctrlB = installDialogFocus(b.overlay, b.dialog, { isVisible: visible });
		expect(document.body.style.overflow).toBe('hidden');

		ctrlB.release();
		// Still locked while the lower dialog remains open.
		expect(document.body.style.overflow).toBe('hidden');

		ctrlA.release();
		expect(document.body.style.overflow).toBe('');
	});

	it('removes a temporary tabindex it added to a dialog with no focusables', async () => {
		const overlay = document.createElement('div');
		const dialog = document.createElement('div');
		overlay.appendChild(dialog);
		document.body.appendChild(overlay);

		const ctrl = installDialogFocus(overlay, dialog, { isVisible: visible });
		await Promise.resolve();
		expect(dialog.getAttribute('tabindex')).toBe('-1');
		expect(document.activeElement).toBe(dialog);

		ctrl.release();
		expect(dialog.hasAttribute('tabindex')).toBe(false);
	});

	it('self-heals when an overlay is removed outside the close path', () => {
		const a = makeDialog();
		installDialogFocus(a.overlay, a.dialog, { isVisible: visible });

		a.overlay.remove();

		expect(isAnyDialogOpen()).toBe(false);
		expect(document.body.style.overflow).toBe('');
		// No active trap remains: a subsequent Tab is not intercepted.
		const event = tab();
		expect(event.defaultPrevented).toBe(false);
	});

	it('stacked: removing the top dialog externally lets the trap fall back to the lower one', () => {
		const a = makeDialog(['a1', 'a2']);
		const b = makeDialog(['b1', 'b2']);
		installDialogFocus(a.overlay, a.dialog, { isVisible: visible });
		installDialogFocus(b.overlay, b.dialog, { isVisible: visible });

		// Remove the top dialog (B) without going through the close path.
		b.overlay.remove();

		a.buttons[1].focus();
		const event = tab();
		expect(event.defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(a.buttons[0]);
	});
});
