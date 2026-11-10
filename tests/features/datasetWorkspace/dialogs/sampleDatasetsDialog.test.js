// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SAMPLE_DATASET_CATALOG } from '../../../../src/data/sampleDatasetCatalog.js';
import { openSampleDatasetsDialog } from '../../../../src/features/datasetWorkspace/dialogs/sampleDatasetsDialog.js';
import { setLocale, t as translate } from '../../../../src/services/i18nService.js';

describe('openSampleDatasetsDialog', () => {
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
		openSampleDatasetsDialog({ translate });

		const cards = document.querySelectorAll('.picker-card');
		const loadButton = document.querySelector('.join-footer .btn-primary');

		expect(cards.length).toBe(SAMPLE_DATASET_CATALOG.length);
		expect(loadButton.disabled).toBe(true);
		expect(cards[0].querySelector('.picker-card-name').textContent).toBe(translate(SAMPLE_DATASET_CATALOG[0].nameKey));
		SAMPLE_DATASET_CATALOG.forEach((entry, index) => {
			expect(cards[index].querySelector('.picker-card-name').textContent).toBe(translate(entry.nameKey));
			expect(cards[index].querySelector('.picker-card-desc').textContent).toBe(translate(entry.descKey));
			const expected = locale === 'en'
				? `${entry.rowCount} rows · ${entry.columnCount} columns`
				: `${entry.rowCount} linhas · ${entry.columnCount} colunas`;
			expect(cards[index].querySelector('.sample-dataset-card-meta').textContent).toBe(expected);
		});
		expect(cards[0].querySelector('.sample-dataset-card-source-link').href)
			.toBe(SAMPLE_DATASET_CATALOG[0].sourceUrl);
		const dialog = document.querySelector('dialog[open]');
		expect(dialog.getAttribute('aria-labelledby')).toBe('sample-datasets-dialog-title');
		expect(document.getElementById('sample-datasets-dialog-title').textContent)
			.toBe(translate('chive-sample-dataset-dialog-title'));
		expect(loadButton.textContent).toBe(translate('chive-sample-dataset-load'));
		expect(dialog.querySelector('.join-footer .btn-secondary').textContent)
			.toBe(translate('chive-sample-dataset-cancel'));
		expect(cards[0].querySelector('.sample-dataset-card-source').textContent)
			.toContain(translate('chive-sample-dataset-source-label'));
		expect(dialog.textContent).not.toContain('chive-');
	});

	it('selects a card and resolves the selected catalog entry on Load', async () => {
		const pending = openSampleDatasetsDialog({ translate });
		const cards = document.querySelectorAll('.picker-card');
		const loadButton = document.querySelector('.join-footer .btn-primary');

		cards[1].click();
		expect(cards[1].classList.contains('selected')).toBe(true);
		expect(cards[0].classList.contains('selected')).toBe(false);
		expect(loadButton.disabled).toBe(false);

		loadButton.click();
		const result = await pending;

		expect(result).toBe(SAMPLE_DATASET_CATALOG[1]);
		expect(document.querySelector('.sample-datasets-dialog')).toBeNull();
	});

	it('cancels on footer cancel, Escape, and backdrop click', async () => {
		let pending = openSampleDatasetsDialog({ translate });
		document.querySelector('.join-footer .btn-secondary').click();
		await expect(pending).resolves.toBeNull();

		pending = openSampleDatasetsDialog({ translate });
		document.querySelector('dialog').dispatchEvent(new Event('cancel', { cancelable: true }));
		await expect(pending).resolves.toBeNull();

		pending = openSampleDatasetsDialog({ translate });
		document.querySelector('dialog').click();
		await expect(pending).resolves.toBeNull();
	});
});
