// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const focusMocks = vi.hoisted(() => ({
	release: vi.fn(),
	restoreFocus: vi.fn(),
	installDialogFocus: vi.fn(() => ({
		release: focusMocks.release,
		restoreFocus: focusMocks.restoreFocus,
	})),
}));

vi.mock('../../../../src/modules/dialogFocus.js', () => ({
	installDialogFocus: focusMocks.installDialogFocus,
}));

import { PRESET_CATALOG } from '../../../../src/data/presetCatalog.js';
import { openPresetDatasetsDialog } from '../../../../src/features/datasetWorkspace/dialogs/presetDatasetsView.js';

const translate = (key, ...args) => (args.length ? `${key}:${args.join(',')}` : key);

describe('openPresetDatasetsDialog', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
		vi.clearAllMocks();
	});

	it('renders catalog cards with metadata and disables load until selection', () => {
		openPresetDatasetsDialog({ translate });

		const cards = document.querySelectorAll('.preset-card');
		const loadButton = document.querySelector('.join-footer .btn-primary');

		expect(cards.length).toBe(PRESET_CATALOG.length);
		expect(loadButton.disabled).toBe(true);
		expect(cards[0].querySelector('.preset-card-name').textContent).toBe(PRESET_CATALOG[0].nameKey);
		expect(cards[0].querySelector('.preset-card-meta').textContent)
			.toBe(`chive-preset-card-meta:${PRESET_CATALOG[0].rows},${PRESET_CATALOG[0].columns}`);
		expect(cards[0].querySelector('.preset-card-source-link').href)
			.toBe(PRESET_CATALOG[0].sourceUrl);
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
		expect(focusMocks.release).toHaveBeenCalled();
		expect(focusMocks.restoreFocus).toHaveBeenCalled();
	});

	it('cancels on footer cancel, Escape, and backdrop click', async () => {
		let pending = openPresetDatasetsDialog({ translate });
		document.querySelector('.join-footer .btn-secondary').click();
		await expect(pending).resolves.toBeNull();

		pending = openPresetDatasetsDialog({ translate });
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		await expect(pending).resolves.toBeNull();

		pending = openPresetDatasetsDialog({ translate });
		document.querySelector('.join-overlay').click();
		await expect(pending).resolves.toBeNull();
	});
});
