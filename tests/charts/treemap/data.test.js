import { describe, expect, it } from 'vitest';
import { aggregateTreemapData } from '../../../src/charts/treemap/data.js';
import { MISSING_KEY } from '../../../src/domain/datasets/cellValues.js';
import { applyChartFilterRows } from '../../../src/domain/filters/chartFilter.js';

const countArgs = { measureMode: 'count', valueColumn: null, topN: 0, missingLabel: '(missing)' };
const pairs = entries => entries.map(entry => [entry.key, entry.value]);

describe('aggregateTreemapData', () => {
	it('counts rows per category, descending', () => {
		const rows = [{ c: 'A' }, { c: 'A' }, { c: 'A' }, { c: 'B' }, { c: 'C' }, { c: 'C' }];
		const result = aggregateTreemapData(rows, 'c', countArgs);
		expect(result.ok).toBe(true);
		expect(pairs(result.entries)).toEqual([['A', 3], ['C', 2], ['B', 1]]);
		expect(result.total).toBe(6);
	});

	it('buckets missing cells apart from literal N/A text', () => {
		const rows = [{ c: 'A' }, { c: null }, { c: 'N/A' }, { c: undefined }];
		const { entries } = aggregateTreemapData(rows, 'c', countArgs);
		expect(entries.find(entry => entry.key === MISSING_KEY)).toEqual({
			key: MISSING_KEY, label: '(missing)', token: '__chive_missing__', value: 2,
		});
		expect(entries.find(entry => entry.key === 'N/A')).toEqual({
			key: 'N/A', label: 'N/A', token: 'v:N/A', value: 1,
		});
	});

	it('hides exactly the missing rows through the missing tile token', () => {
		const rows = [{ c: 'A' }, { c: null }, { c: 'N/A' }, { c: null }];
		const { entries } = aggregateTreemapData(rows, 'c', countArgs);
		const missing = entries.find(entry => entry.key === MISSING_KEY);
		const kept = applyChartFilterRows(rows, { column: 'c', exclude: [missing.token] });
		expect(kept).toEqual([{ c: 'A' }, { c: 'N/A' }]);
	});

	it('breaks count ties by ascending key with the missing bucket last', () => {
		const rows = [{ c: null }, { c: 'B' }, { c: 'A' }];
		expect(pairs(aggregateTreemapData(rows, 'c', countArgs).entries)).toEqual([['A', 1], ['B', 1], [MISSING_KEY, 1]]);
	});

	it('sums a numeric value column and skips non-finite values', () => {
		const rows = [
			{ c: 'A', v: 10 },
			{ c: 'A', v: null },
			{ c: 'B', v: 4 },
		];
		const result = aggregateTreemapData(rows, 'c', { measureMode: 'sum', valueColumn: 'v', topN: 0 });
		expect(pairs(result.entries)).toEqual([['A', 10], ['B', 4]]);
		expect(result.total).toBe(14);
	});

	it('drops categories whose summed value is not > 0', () => {
		const rows = [{ c: 'A', v: 5 }, { c: 'B', v: 0 }, { c: 'C', v: -3 }];
		const result = aggregateTreemapData(rows, 'c', { measureMode: 'sum', valueColumn: 'v', topN: 0 });
		expect(pairs(result.entries)).toEqual([['A', 5]]);
	});

	it('fails with no-value-column when sum mode lacks a usable value column', () => {
		expect(aggregateTreemapData([{ c: 'A' }], 'c', { measureMode: 'sum', valueColumn: null, topN: 0 }))
			.toEqual({ ok: false, reason: 'no-value-column' });
		expect(aggregateTreemapData([{ c: 'A' }], 'c', { measureMode: 'sum', valueColumn: 'missing', topN: 0 }))
			.toEqual({ ok: false, reason: 'no-value-column' });
	});

	it('fails (no reason) on empty input', () => {
		expect(aggregateTreemapData([], 'c', countArgs)).toEqual({ ok: false });
	});

	it('trims to Top-N and computes total over the trimmed entries (post-trim base)', () => {
		const rows = [
			{ c: 'A' }, { c: 'A' }, { c: 'A' }, // 3
			{ c: 'B' }, { c: 'B' },             // 2
			{ c: 'C' },                          // 1
		];
		const result = aggregateTreemapData(rows, 'c', { measureMode: 'count', valueColumn: null, topN: 2 });
		expect(pairs(result.entries)).toEqual([['A', 3], ['B', 2]]);
		// total is 5 (rendered cells), NOT 6 (all rows): the percentage base is post-trim.
		expect(result.total).toBe(5);
	});
});
