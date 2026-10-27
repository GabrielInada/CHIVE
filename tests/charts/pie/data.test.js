import { describe, expect, it } from 'vitest';
import { OTHER_SECTOR_KEY, aggregatePieData } from '../../../src/charts/pie/data.js';
import { MISSING_KEY } from '../../../src/domain/datasets/cellValues.js';
import { applyChartFilterRows } from '../../../src/domain/filters/chartFilter.js';

const countArgs = {
	measureMode: 'count', valueColumn: null, topN: 0, topNMode: 'other', otherLabel: 'Other', missingLabel: '(missing)',
};
const sectors = entries => entries.map(({ key, value, isOther }) => (isOther ? { key, value, isOther } : { key, value }));

describe('aggregatePieData', () => {
	it('counts rows per category, descending with a string tiebreak', () => {
		const rows = [{ c: 'B' }, { c: 'A' }, { c: 'A' }, { c: 'C' }, { c: 'C' }];
		const result = aggregatePieData(rows, 'c', countArgs);
		expect(result.ok).toBe(true);
		expect(sectors(result.entries)).toEqual([
			{ key: 'A', value: 2 },
			{ key: 'C', value: 2 },
			{ key: 'B', value: 1 },
		]);
		expect(result.total).toBe(5);
	});

	it('buckets missing cells apart from literal N/A text', () => {
		const rows = [{ c: 'A' }, { c: null }, { c: 'N/A' }, {}];
		const { entries } = aggregatePieData(rows, 'c', countArgs);
		expect(entries.find(entry => entry.key === MISSING_KEY)).toEqual({
			key: MISSING_KEY, label: '(missing)', token: '__chive_missing__', value: 2,
		});
		expect(entries.find(entry => entry.key === 'N/A')).toEqual({
			key: 'N/A', label: 'N/A', token: 'v:N/A', value: 1,
		});
	});

	it('hides exactly the missing rows through the missing sector token', () => {
		const rows = [{ c: 'A' }, { c: null }, { c: 'N/A' }, { c: null }];
		const { entries } = aggregatePieData(rows, 'c', countArgs);
		const missing = entries.find(entry => entry.key === MISSING_KEY);
		const kept = applyChartFilterRows(rows, { column: 'c', exclude: [missing.token] });
		expect(kept).toEqual([{ c: 'A' }, { c: 'N/A' }]);
	});

	it('breaks value ties with the missing bucket last', () => {
		const rows = [{ c: null }, { c: 'B' }, { c: 'A' }];
		expect(aggregatePieData(rows, 'c', countArgs).entries.map(entry => entry.key)).toEqual(['A', 'B', MISSING_KEY]);
	});

	it('labels the Other sector and gives it no filter token', () => {
		const rows = [{ c: 'A' }, { c: 'A' }, { c: 'B' }, { c: 'C' }];
		const other = aggregatePieData(rows, 'c', { ...countArgs, topN: 1 }).entries.at(-1);
		expect(other).toEqual({ key: OTHER_SECTOR_KEY, label: 'Other', token: null, value: 2, isOther: true });
	});

	it('keeps a real category spelled like the Other label apart from the Other sector', () => {
		const rows = ['Other', 'Other', 'Other', 'A', 'A', 'B', 'C'].map(c => ({ c }));
		const { entries } = aggregatePieData(rows, 'c', { ...countArgs, topN: 2 });
		expect(sectors(entries)).toEqual([
			{ key: 'Other', value: 3 },
			{ key: 'A', value: 2 },
			{ key: OTHER_SECTOR_KEY, value: 2, isOther: true },
		]);
	});

	it('sums a numeric value column and skips non-finite values', () => {
		const rows = [{ c: 'A', v: 10 }, { c: 'A', v: null }, { c: 'B', v: 4 }];
		const result = aggregatePieData(rows, 'c', { ...countArgs, measureMode: 'sum', valueColumn: 'v' });
		expect(sectors(result.entries)).toEqual([
			{ key: 'A', value: 10 },
			{ key: 'B', value: 4 },
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
		expect(sectors(result.entries)).toEqual([
			{ key: 'A', value: 3 },
			{ key: 'B', value: 2 },
		]);
		expect(result.total).toBe(5);
	});

	it('other mode folds the tail into one bucket using the caller-supplied Other label', () => {
		const rows = [{ c: 'A' }, { c: 'A' }, { c: 'A' }, { c: 'B' }, { c: 'B' }, { c: 'C' }, { c: 'D' }];
		const result = aggregatePieData(rows, 'c', { ...countArgs, topN: 2, topNMode: 'other', otherLabel: 'Outros' });
		expect(sectors(result.entries)).toEqual([
			{ key: 'A', value: 3 },
			{ key: 'B', value: 2 },
			{ key: OTHER_SECTOR_KEY, value: 2, isOther: true },
		]);
		// total is over the rendered sectors (incl. the Other bucket).
		expect(result.total).toBe(7);
	});
});
