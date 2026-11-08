// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PRESET_CATALOG } from '../../../../src/data/presetCatalog.js';
import { openPresetDatasetsDialog } from '../../../../src/features/datasetWorkspace/dialogs/presetDatasetsView.js';
import { setLocale, t as translate } from '../../../../src/services/i18nService.js';

describe('openPresetDatasetsDialog', () => {
	beforeEach(async () => {
		document.body.innerHTML = '';
		await setLocale('en');
	});

	afterEach(() => {
		document.querySelector('.join-footer .btn-secondary')?.click();
		localStorage.clear();
	});

	it.each(['en', 'pt-BR'])('renders translated card metadata in %s and disables load until selection', async locale => {
		await setLocale(locale);
		openPresetDatasetsDialog({ translate });

		const cards = document.querySelectorAll('.preset-card');
		const loadButton = document.querySelector('.join-footer .btn-primary');

		expect(cards.length).toBe(PRESET_CATALOG.length);
		expect(loadButton.disabled).toBe(true);
		expect(cards[0].querySelector('.preset-card-name').textContent).toBe(translate(PRESET_CATALOG[0].nameKey));
		PRESET_CATALOG.forEach((entry, index) => {
			const expected = locale === 'en'
				? `${entry.rows} rows · ${entry.columns} columns`
				: `${entry.rows} linhas · ${entry.columns} colunas`;
			expect(cards[index].querySelector('.preset-card-meta').textContent).toBe(expected);
		});
		expect(cards[0].querySelector('.preset-card-source-link').href)
			.toBe(PRESET_CATALOG[0].sourceUrl);
		const dialog = document.querySelector('dialog[open]');
		expect(dialog.getAttribute('aria-labelledby')).toBe('preset-dialog-title');
	});

	it('selects a card and resolves the selected catalog entry on Load', async () => {
		const pending = openPresetDatasetsDialog({ translate });
		const cards = document.querySelectorAll('.preset-card');
		const loadButton = document.querySelector('.join-footer .btn-primary');

		cards[1].click();
		expect(cards[1].classList.contains('selected')).toBe(true);
		expect(cards[0].classList.contains('selected')).toBe(false);
		expect(loadButton.disabled).toBe(false);

		loadButton.click();
		const result = await pending;

		expect(result).toBe(PRESET_CATALOG[1]);
		expect(document.querySelector('.preset-dialog')).toBeNull();
	});

	it('cancels on footer cancel, Escape, and backdrop click', async () => {
		let pending = openPresetDatasetsDialog({ translate });
		document.querySelector('.join-footer .btn-secondary').click();
		await expect(pending).resolves.toBeNull();

		pending = openPresetDatasetsDialog({ translate });
		document.querySelector('dialog').dispatchEvent(new Event('cancel', { cancelable: true }));
		await expect(pending).resolves.toBeNull();

		pending = openPresetDatasetsDialog({ translate });
		document.querySelector('dialog').click();
		await expect(pending).resolves.toBeNull();
	});
});
