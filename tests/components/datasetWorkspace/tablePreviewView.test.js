// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn(key => key),
	translateType: vi.fn(type => `type:${type}`),
	getLocale: vi.fn(() => 'en-US'),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
	translateType: mocks.translateType,
	getLocale: mocks.getLocale,
}));

import { renderTablePreview } from '../../../src/components/datasetWorkspace/tablePreviewView.js';

describe('renderTablePreview', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="table-container"></div>';
		vi.clearAllMocks();
	});

	it('renders an empty-column placeholder when no columns are visible', () => {
		renderTablePreview([{ value: 1 }], [], 10);

		expect(document.querySelector('.table-no-columns').textContent).toBe('chive-no-columns-selected');
		expect(document.querySelector('table')).toBeNull();
	});

	it('renders a limited table with row indexes, typed cells, and a type footer', () => {
		renderTablePreview(
			[
				{ name: 'Alpha', value: 1234.5, missing: null },
				{ name: 'Beta', value: 2, missing: '' },
				{ name: 'Gamma', value: 3, missing: 'kept out by limit' },
			],
			[
				{ name: 'name', type: 'text' },
				{ name: 'value', type: 'number' },
				{ name: 'missing', type: 'text' },
			],
			2,
		);

		const table = document.querySelector('table.table-preview');
		expect(table).not.toBeNull();
		expect(table.querySelectorAll('tbody tr').length).toBe(2);
		expect(table.querySelector('thead th.row-index').textContent).toBe('#');
		expect(table.querySelector('thead th.num').textContent).toBe('value');

		const rows = table.querySelectorAll('tbody tr');
		expect(rows[0].querySelector('.row-index').textContent).toBe('1');
		expect(rows[0].querySelector('td.num').textContent).toBe('1,234.5');
		expect(rows[0].lastElementChild.textContent).toBe('\u2014');
		expect(rows[1].lastElementChild.textContent).toBe('\u2014');

		expect(Array.from(table.querySelectorAll('tfoot td')).map(td => td.textContent))
			.toEqual(['', 'type:text', 'type:number', 'type:text']);
	});
});
