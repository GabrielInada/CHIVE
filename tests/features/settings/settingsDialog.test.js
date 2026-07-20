// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/services/i18nService.js', () => ({
	t: key => `t:${key}`,
}));

import { openSettingsDialog } from '../../../src/features/settings/settingsDialog.js';

const openHandles = [];

function openDialog(overrides = {}) {
	const handle = openSettingsDialog({
		locale: 'pt-BR',
		tinColorRendering: 'optimized',
		onLocaleChange: vi.fn().mockResolvedValue({ ok: true }),
		onTinColorRenderingChange: vi.fn(),
		onGetStorageStatus: vi.fn().mockResolvedValue({
			ok: true,
			usage: 1024,
			quota: 4096,
			persisted: false,
		}),
		onRequestPersistentStorage: vi.fn().mockResolvedValue({ ok: true, granted: true }),
		onClose: vi.fn(),
		...overrides,
	});
	openHandles.push(handle);
	return handle;
}

describe('settingsDialog', () => {
	beforeEach(() => {
		document.body.innerHTML = '<button id="trigger" type="button">open</button>';
	});

	afterEach(() => {
		openHandles.splice(0).forEach(handle => handle.close());
		document.body.innerHTML = '';
	});

	it('renders the General and Performance sections with localized labels', () => {
		openDialog();

		const dialog = document.querySelector('dialog[open]');
		expect(dialog).not.toBeNull();
		expect(dialog.getAttribute('aria-labelledby')).toBe('settings-dialog-title');

		const sectionTitles = Array.from(dialog.querySelectorAll('.settings-section-title'))
			.map(el => el.dataset.i18n);
		expect(sectionTitles).toEqual([
			'chive-settings-section-general',
			'chive-settings-section-performance',
			'chive-settings-section-storage',
		]);

		// Labels are translated now and carry data-i18n for in-place retranslation.
		expect(dialog.querySelector('#settings-dialog-title').textContent).toBe('t:chive-settings-title');
		expect(dialog.querySelector('[data-i18n="chive-settings-language"]')).not.toBeNull();
		expect(dialog.querySelector('[data-i18n="chive-settings-tin-rendering"]')).not.toBeNull();
		expect(dialog.querySelector('[data-i18n="chive-settings-tin-hint"]')).not.toBeNull();
	});

	it('preselects the current locale and the stored TIN mode', () => {
		openDialog({ locale: 'en', tinColorRendering: 'full-ramp' });

		const select = document.getElementById('settings-language-select');
		expect(select.value).toBe('en');
		expect(Array.from(select.options).map(option => option.value)).toEqual(['pt-BR', 'en']);

		const checked = document.querySelector('input[name="settings-tin-color-rendering"]:checked');
		expect(checked.value).toBe('full-ramp');
	});

	it('disables the selector while applying a language change and keeps focus', async () => {
		const onLocaleChange = vi.fn().mockResolvedValue({ ok: true });
		openDialog({ onLocaleChange });

		const select = document.getElementById('settings-language-select');
		select.focus();
		select.value = 'en';
		select.dispatchEvent(new Event('change', { bubbles: true }));

		expect(onLocaleChange).toHaveBeenCalledWith('en');
		expect(select.disabled).toBe(true);
		await Promise.resolve();
		expect(document.querySelector('dialog[open]')).not.toBeNull();
		expect(select.disabled).toBe(false);
		expect(select.value).toBe('en');
		expect(document.activeElement).toBe(select);
	});

	it('reverts the locale selector when the asynchronous change fails', async () => {
		const onLocaleChange = vi.fn().mockResolvedValue({ ok: false, reason: 'storage-unavailable' });
		openDialog({ locale: 'pt-BR', onLocaleChange });

		const select = document.getElementById('settings-language-select');
		select.value = 'en';
		select.dispatchEvent(new Event('change', { bubbles: true }));
		await Promise.resolve();

		expect(select.value).toBe('pt-BR');
		expect(select.disabled).toBe(false);
	});

	it('applies a TIN mode change immediately through the callback', () => {
		const onTinColorRenderingChange = vi.fn();
		openDialog({ onTinColorRenderingChange });

		const fullRamp = document.querySelector('input[name="settings-tin-color-rendering"][value="full-ramp"]');
		fullRamp.checked = true;
		fullRamp.dispatchEvent(new Event('change', { bubbles: true }));

		expect(onTinColorRenderingChange).toHaveBeenCalledWith('full-ramp');
	});

	it('reads quota on open but requests persistence only from the explicit action', async () => {
		const onGetStorageStatus = vi.fn()
			.mockResolvedValueOnce({ ok: true, usage: 1024, quota: 4096, persisted: false })
			.mockResolvedValueOnce({ ok: true, usage: 1024, quota: 4096, persisted: true });
		const onRequestPersistentStorage = vi.fn().mockResolvedValue({ ok: true, granted: true });
		openDialog({ onGetStorageStatus, onRequestPersistentStorage });
		await Promise.resolve();
		await Promise.resolve();

		expect(onGetStorageStatus).toHaveBeenCalledTimes(1);
		expect(onRequestPersistentStorage).not.toHaveBeenCalled();
		const button = document.querySelector('.settings-storage-persist');
		expect(button.hidden).toBe(false);

		button.click();
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();

		expect(onRequestPersistentStorage).toHaveBeenCalledTimes(1);
		expect(onGetStorageStatus).toHaveBeenCalledTimes(2);
		expect(button.hidden).toBe(true);
	});

	it('closes on the close button and restores focus to the trigger', async () => {
		const trigger = document.getElementById('trigger');
		trigger.focus();
		const onClose = vi.fn();
		openDialog({ onClose });

		document.querySelector('.settings-close-btn').click();

		expect(document.querySelector('dialog')).toBeNull();
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(document.activeElement).toBe(trigger);
	});

	it('closes on Escape', () => {
		const onClose = vi.fn();
		openDialog({ onClose });

		document.querySelector('dialog').dispatchEvent(new Event('cancel', { cancelable: true }));

		expect(document.querySelector('dialog')).toBeNull();
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('closes on a backdrop click but not on a click inside the dialog', () => {
		const onClose = vi.fn();
		openDialog({ onClose });

		document.querySelector('.settings-dialog').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(document.querySelector('dialog[open]')).not.toBeNull();

		const dialog = document.querySelector('dialog');
		dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(document.querySelector('dialog')).toBeNull();
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('invokes onClose only once across repeated close paths', () => {
		const onClose = vi.fn();
		const handle = openDialog({ onClose });

		handle.close();
		handle.close();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

		expect(onClose).toHaveBeenCalledTimes(1);
	});
});
