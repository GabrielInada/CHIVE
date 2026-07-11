import { describe, expect, it } from 'vitest';
import { aggregatePieData } from '../../../src/charts/pie/data.js';

const countArgs = { measureMode: 'count', valueColumn: null, topN: 0, topNMode: 'other', otherLabel: 'Other' };

describe('aggregatePieData', () => {
	it('counts rows per category, descending with a string tiebreak', () => {
		const rows = [{ c: 'B' }, { c: 'A' }, { c: 'A' }, { c: 'C' }, { c: 'C' }];
		const result = aggregatePieData(rows, 'c', countArgs);
		expect(result.ok).toBe(true);
		expect(result.entries).toEqual([
			{ category: 'A', value: 2 },
			{ category: 'C', value: 2 },
			{ category: 'B', value: 1 },
		]);
		expect(result.total).toBe(5);
	});

	it('buckets null/empty categories into N/A', () => {
		const rows = [{ c: 'A' }, { c: null }, { c: '' }];
		const naEntry = aggregatePieData(rows, 'c', countArgs).entries.find(e => e.category === 'N/A');
		expect(naEntry).toEqual({ category: 'N/A', value: 2 });
	});

	it('sums a numeric value column and skips non-finite values', () => {
		const rows = [{ c: 'A', v: 10 }, { c: 'A', v: 'x' }, { c: 'B', v: 4 }];
		const result = aggregatePieData(rows, 'c', { ...countArgs, measureMode: 'sum', valueColumn: 'v' });
		expect(result.entries).toEqual([
			{ category: 'A', value: 10 },
			{ category: 'B', value: 4 },
		]);
	});

	it('fails with sum-no-numeric for empty sum, and no reason for empty count', () => {
		expect(aggregatePieData([], 'c', { ...countArgs, measureMode: 'sum', valueColumn: 'v' }))
			.toEqual({ ok: false, reason: 'sum-no-numeric' });
		expect(aggregatePieData([], 'c', countArgs)).toEqual({ ok: false, reason: undefined });
	});

	it('truncate mode drops the tail past Top-N', () => {
		const rows = [{ c: 'A' }, { c: 'A' }, { c: 'A' }, { c: 'B' }, { c: 'B' }, { c: 'C' }];
		const result = aggregatePieData(rows, 'c', { ...countArgs, topN: 2, topNMode: 'truncate' });
		expect(result.entries).toEqual([
			{ category: 'A', value: 3 },
			{ category: 'B', value: 2 },
		]);
		expect(result.total).toBe(5);
	});

	it('other mode folds the tail into one bucket using the caller-supplied Other label', () => {
		const rows = [{ c: 'A' }, { c: 'A' }, { c: 'A' }, { c: 'B' }, { c: 'B' }, { c: 'C' }, { c: 'D' }];
		const result = aggregatePieData(rows, 'c', { ...countArgs, topN: 2, topNMode: 'other', otherLabel: 'Outros' });
		expect(result.entries).toEqual([
			{ category: 'A', value: 3 },
			{ category: 'B', value: 2 },
			{ category: 'Outros', value: 2, isOther: true },
		]);
		// total is over the rendered sectors (incl. the Other bucket).
		expect(result.total).toBe(7);
	});
});
