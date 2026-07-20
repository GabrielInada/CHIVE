// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn(key => key),
	translateType: vi.fn(type => `type:${type}`),
	getLocale: vi.fn(() => 'en-US'),
}));

vi.mock('../../../../src/services/i18nService.js', () => ({
	t: mocks.t,
	translateType: mocks.translateType,
	getLocale: mocks.getLocale,
}));

import { renderTablePreview } from '../../../../src/features/datasetWorkspace/views/tablePreviewView.js';

describe('renderTablePreview', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="table-container"></div>';
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.useRealTimers();
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

	it('chunks previews above 2,000 cells and exposes aria-busy until complete', async () => {
		vi.useFakeTimers();
		const rows = Array.from({ length: 1000 }, (_, index) => ({
			a: index,
			b: index + 1,
			c: index + 2,
		}));

		renderTablePreview(rows, [
			{ name: 'a', type: 'number' },
			{ name: 'b', type: 'number' },
			{ name: 'c', type: 'number' },
		], 1000);

		const container = document.getElementById('table-container');
		expect(container.getAttribute('aria-busy')).toBe('true');
		expect(container.querySelectorAll('tbody tr')).toHaveLength(0);

		await vi.runAllTimersAsync();
		expect(container.querySelectorAll('tbody tr')).toHaveLength(1000);
		expect(container.hasAttribute('aria-busy')).toBe(false);
	});

	it('cancels stale chunks when a newer preview replaces the table', async () => {
		vi.useFakeTimers();
		const rows = Array.from({ length: 1000 }, (_, index) => ({ value: index }));
		const columns = [
			{ name: 'value', type: 'number' },
			{ name: 'value2', type: 'number' },
		];

		renderTablePreview(rows, columns, 1000);
		renderTablePreview([{ value: 7 }], [{ name: 'value', type: 'number' }], 1);
		await vi.runAllTimersAsync();

		const container = document.getElementById('table-container');
		expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
		expect(container.querySelector('tbody td.num').textContent).toBe('7');
		expect(container.hasAttribute('aria-busy')).toBe(false);
	});
});
