// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	isAnyDialogOpen: vi.fn(() => false),
}));

vi.mock('../../../src/ui/dialogFocus.js', () => ({
	isAnyDialogOpen: mocks.isAnyDialogOpen,
}));

import { setupGlobalKeyboardListeners } from '../../../src/app/bindings/keyboardShortcuts.js';

describe('eventHandlers', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.isAnyDialogOpen.mockReturnValue(false);
		document.body.innerHTML = '<input id="file-input" type="file" />';
	});

	it('Ctrl/Cmd+O opens the file picker and prevents default when no dialog is open', () => {
		mocks.isAnyDialogOpen.mockReturnValue(false);
		setupGlobalKeyboardListeners();
		const clickSpy = vi.spyOn(document.getElementById('file-input'), 'click');

		const event = new KeyboardEvent('keydown', { key: 'o', ctrlKey: true, bubbles: true, cancelable: true });
		document.dispatchEvent(event);

		expect(event.defaultPrevented).toBe(true);
		expect(clickSpy).toHaveBeenCalled();
	});

	it('Ctrl/Cmd+O does not open the file picker behind an open modal dialog', () => {
		mocks.isAnyDialogOpen.mockReturnValue(true);
		setupGlobalKeyboardListeners();
		const clickSpy = vi.spyOn(document.getElementById('file-input'), 'click');

		const event = new KeyboardEvent('keydown', { key: 'o', metaKey: true, bubbles: true, cancelable: true });
		document.dispatchEvent(event);

		// Default is still prevented so the browser's native open dialog never shows.
		expect(event.defaultPrevented).toBe(true);
		expect(clickSpy).not.toHaveBeenCalled();
	});

	it('skips global shortcuts when the event was already defaultPrevented', () => {
		mocks.isAnyDialogOpen.mockReturnValue(false);
		setupGlobalKeyboardListeners();
		const clickSpy = vi.spyOn(document.getElementById('file-input'), 'click');

		const event = new KeyboardEvent('keydown', { key: 'o', ctrlKey: true, bubbles: true, cancelable: true });
		event.preventDefault();
		document.dispatchEvent(event);

		expect(clickSpy).not.toHaveBeenCalled();
	});
});
