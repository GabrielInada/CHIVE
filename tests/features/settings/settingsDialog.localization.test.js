// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { openSettingsDialog } from '../../../src/features/settings/settingsDialog.js';
import { setLocale } from '../../../src/services/i18nService.js';

let handle;

afterEach(() => {
	handle?.close();
	document.body.replaceChildren();
	localStorage.clear();
});

describe('settings storage usage translation', () => {
	it.each(['en', 'pt-BR'])('fills both amounts in %s and refreshes them after changing language', async locale => {
		await setLocale(locale);
		handle = openSettingsDialog({
			locale,
			tinColorRendering: 'optimized',
			onLocaleChange: setLocale,
			onTinColorRenderingChange() {},
			onGetStorageStatus: async () => ({
				ok: true,
				usage: 1258291,
				quota: 5242880,
				persisted: false,
			}),
		});
		const messages = {
			en: 'Using 1.2 MB of 5.0 MB.',
			'pt-BR': 'Em uso: 1.2 MB de 5.0 MB.',
		};
		const usage = document.querySelector('.settings-storage-usage');
		await vi.waitFor(() => expect(usage.textContent).toBe(messages[locale]));
		expect(usage.hidden).toBe(false);

		const select = document.getElementById('settings-language-select');
		const nextLocale = locale === 'en' ? 'pt-BR' : 'en';
		select.focus();
		select.value = nextLocale;
		select.dispatchEvent(new Event('change', { bubbles: true }));

		await vi.waitFor(() => expect(usage.textContent).toBe(messages[nextLocale]));
		expect(document.querySelector('.settings-storage-usage')).toBe(usage);
		expect(document.activeElement).toBe(select);
		expect(usage.hidden).toBe(false);
	});
});
