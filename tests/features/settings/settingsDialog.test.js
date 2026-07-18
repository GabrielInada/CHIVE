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
		onLocaleChange: vi.fn(),
		onTinColorRenderingChange: vi.fn(),
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

		const dialog = document.querySelector('.settings-dialog');
		expect(dialog).not.toBeNull();
		expect(dialog.getAttribute('role')).toBe('dialog');
		expect(dialog.getAttribute('aria-modal')).toBe('true');
		expect(dialog.getAttribute('aria-labelledby')).toBe('settings-dialog-title');

		const sectionTitles = Array.from(dialog.querySelectorAll('.settings-section-title'))
			.map(el => el.dataset.i18n);
		expect(sectionTitles).toEqual([
			'chive-settings-section-general',
			'chive-settings-section-performance',
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

	it('applies a language change immediately and keeps the dialog open with focus preserved', () => {
		const onLocaleChange = vi.fn();
		openDialog({ onLocaleChange });

		const select = document.getElementById('settings-language-select');
		select.focus();
		select.value = 'en';
		select.dispatchEvent(new Event('change', { bubbles: true }));

		expect(onLocaleChange).toHaveBeenCalledWith('en');
		expect(document.querySelector('.settings-overlay')).not.toBeNull();
		expect(document.activeElement).toBe(select);
	});

	it('applies a TIN mode change immediately through the callback', () => {
		const onTinColorRenderingChange = vi.fn();
		openDialog({ onTinColorRenderingChange });

		const fullRamp = document.querySelector('input[name="settings-tin-color-rendering"][value="full-ramp"]');
		fullRamp.checked = true;
		fullRamp.dispatchEvent(new Event('change', { bubbles: true }));

		expect(onTinColorRenderingChange).toHaveBeenCalledWith('full-ramp');
	});

	it('closes on the close button and restores focus to the trigger', async () => {
		const trigger = document.getElementById('trigger');
		trigger.focus();
		const onClose = vi.fn();
		openDialog({ onClose });

		document.querySelector('.settings-close-btn').click();

		expect(document.querySelector('.settings-overlay')).toBeNull();
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(document.activeElement).toBe(trigger);
	});

	it('closes on Escape', () => {
		const onClose = vi.fn();
		openDialog({ onClose });

		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

		expect(document.querySelector('.settings-overlay')).toBeNull();
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('closes on a backdrop click but not on a click inside the dialog', () => {
		const onClose = vi.fn();
		openDialog({ onClose });

		document.querySelector('.settings-dialog').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(document.querySelector('.settings-overlay')).not.toBeNull();

		const overlay = document.querySelector('.settings-overlay');
		overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(document.querySelector('.settings-overlay')).toBeNull();
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
