import { describe, expect, it } from 'vitest';
import { OTHER_SECTOR_KEY, aggregatePieData } from '../../../src/charts/pie/data.js';
import { MISSING_KEY } from '../../../src/domain/datasets/cellValues.js';

const countArgs = {
	measureMode: 'count', valueColumn: null, topN: 0, topNMode: 'other', otherLabel: 'Other', missingLabel: '(missing)',
};
const sectors = entries => entries.map(({ key, value, isOther }) => (isOther ? { key, value, isOther } : { key, value }));

describe('aggregatePieData', () => {
	it('sums categories through the shared category aggregation', () => {
		const rows = [{ c: 'A', v: 10 }, { c: 'A', v: 20 }, { c: null, v: 5 }];
		const result = aggregatePieData(rows, 'c', {
			...countArgs, measureMode: 'sum', valueColumn: 'v', missingLabel: '(sem valor)',
		});
		expect(result.entries.map(({ key, label, value }) => [key, label, value]))
			.toEqual([['A', 'A', 30], [MISSING_KEY, '(sem valor)', 5]]);
		expect(result.total).toBe(35);
	});

	it('counts rows for a measure other than sum, as the color controls pass the saved config as is', () => {
		const rows = [{ c: 'A', v: 10 }, { c: 'A', v: 20 }, { c: 'B', v: 50 }];
		const result = aggregatePieData(rows, 'c', { ...countArgs, measureMode: 'mean', valueColumn: 'v' });
		expect(sectors(result.entries)).toEqual([{ key: 'A', value: 2 }, { key: 'B', value: 1 }]);
	});

	it('passes the shared failures through', () => {
		expect(aggregatePieData([{ c: 'A' }], 'c', { ...countArgs, measureMode: 'sum', valueColumn: null }))
			.toEqual({ ok: false, reason: 'no-value-column' });
		expect(aggregatePieData([{ c: 'A', v: null }], 'c', { ...countArgs, measureMode: 'sum', valueColumn: 'v' }))
			.toEqual({ ok: false, reason: 'no-numeric' });
		expect(aggregatePieData([], 'c', countArgs)).toEqual({ ok: false });
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

	it('leaves out categories whose total is 0 or less', () => {
		const rows = [{ c: 'A', v: 5 }, { c: 'B', v: -3 }, { c: 'C', v: 2 }, { c: 'D', v: 0 }];
		const result = aggregatePieData(rows, 'c', { ...countArgs, measureMode: 'sum', valueColumn: 'v' });
		expect(sectors(result.entries)).toEqual([{ key: 'A', value: 5 }, { key: 'C', value: 2 }]);
		expect(result.total).toBe(7);
	});

	it.each([
		['every total negative', -5, -3],
		['the largest total 0', 0, -3],
		['every total 0', 0, 0],
	])('fails with no-positive-value with %s', (_label, a, b) => {
		const rows = [{ c: 'A', v: a }, { c: 'B', v: b }];
		expect(aggregatePieData(rows, 'c', { ...countArgs, measureMode: 'sum', valueColumn: 'v' }))
			.toEqual({ ok: false, reason: 'no-positive-value' });
	});

	it('folds only totals above 0 into the Other sector', () => {
		// T01 to T10 sum to 20 down to 11, T11 to 4 and T12 to -6.
		const rows = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 4, -6]
			.map((v, index) => ({ c: `T${String(index + 1).padStart(2, '0')}`, v }));
		const result = aggregatePieData(rows, 'c', { ...countArgs, measureMode: 'sum', valueColumn: 'v', topN: 10 });
		expect(sectors(result.entries).at(-1)).toEqual({ key: OTHER_SECTOR_KEY, value: 4, isOther: true });
		expect(result.total).toBe(159);
	});

	it('makes no Other sector when only totals at or below 0 are past Top-N', () => {
		const rows = [{ c: 'A', v: 5 }, { c: 'B', v: -3 }, { c: 'C', v: 2 }];
		const result = aggregatePieData(rows, 'c', { ...countArgs, measureMode: 'sum', valueColumn: 'v', topN: 2 });
		expect(sectors(result.entries)).toEqual([{ key: 'A', value: 5 }, { key: 'C', value: 2 }]);
	});
});
