import { describe, expect, it } from 'vitest';
import { aggregateBarData } from '../../../src/charts/bar/data.js';
import { MISSING_KEY } from '../../../src/domain/datasets/cellValues.js';
import { applyChartFilterRows } from '../../../src/domain/filters/chartFilter.js';

const countArgs = { measureMode: 'count', valueColumn: null, sort: 'count-desc', topN: 0, missingLabel: '(missing)' };
const pairs = entries => entries.map(entry => [entry.key, entry.value]);

describe('aggregateBarData', () => {
	it('counts rows per category, descending with a string tiebreak', () => {
		const rows = [{ c: 'B' }, { c: 'A' }, { c: 'A' }, { c: 'A' }, { c: 'B' }, { c: 'C' }];
		const result = aggregateBarData(rows, 'c', countArgs);
		expect(result.ok).toBe(true);
		expect(pairs(result.entries)).toEqual([['A', 3], ['B', 2], ['C', 1]]);
		expect(result.total).toBe(6);
	});

	it('buckets missing cells apart from literal N/A text', () => {
		const rows = [{ c: 'A' }, { c: null }, { c: 'N/A' }, {}];
		const { entries } = aggregateBarData(rows, 'c', countArgs);
		expect(entries.find(entry => entry.key === MISSING_KEY)).toEqual({
			key: MISSING_KEY, label: '(missing)', token: '__chive_missing__', value: 2,
		});
		expect(entries.find(entry => entry.key === 'N/A')).toEqual({
			key: 'N/A', label: 'N/A', token: 'v:N/A', value: 1,
		});
	});

	it('hides exactly the missing rows through the missing entry token', () => {
		const rows = [{ c: 'A' }, { c: null }, { c: 'N/A' }, { c: null }];
		const { entries } = aggregateBarData(rows, 'c', countArgs);
		const missing = entries.find(entry => entry.key === MISSING_KEY);
		const kept = applyChartFilterRows(rows, { column: 'c', exclude: [missing.token] });
		expect(kept).toEqual([{ c: 'A' }, { c: 'N/A' }]);
	});

	it('keeps the missing bucket last in both label sorts', () => {
		const rows = [{ c: 'B' }, { c: null }, { c: 'A' }];
		const keys = sort => aggregateBarData(rows, 'c', { ...countArgs, sort }).entries.map(entry => entry.key);
		expect(keys('label-asc')).toEqual(['A', 'B', MISSING_KEY]);
		expect(keys('label-desc')).toEqual(['B', 'A', MISSING_KEY]);
	});

	it('honors each sort mode', () => {
		const rows = [{ c: 'A' }, { c: 'A' }, { c: 'B' }, { c: 'C' }, { c: 'C' }, { c: 'C' }];
		const names = (sort) => aggregateBarData(rows, 'c', { ...countArgs, sort }).entries.map(e => e.key);
		expect(names('count-desc')).toEqual(['C', 'A', 'B']);
		expect(names('count-asc')).toEqual(['B', 'A', 'C']);
		expect(names('label-asc')).toEqual(['A', 'B', 'C']);
		expect(names('label-desc')).toEqual(['C', 'B', 'A']);
	});

	it('sums a numeric value column and skips non-finite values', () => {
		const rows = [{ c: 'A', v: 10 }, { c: 'A', v: null }, { c: 'B', v: 4 }];
		const result = aggregateBarData(rows, 'c', { ...countArgs, measureMode: 'sum', valueColumn: 'v' });
		expect(pairs(result.entries)).toEqual([['A', 10], ['B', 4]]);
	});

	it('averages per category in mean mode', () => {
		const rows = [{ c: 'A', v: 10 }, { c: 'A', v: 20 }, { c: 'B', v: 5 }];
		const result = aggregateBarData(rows, 'c', { ...countArgs, measureMode: 'mean', valueColumn: 'v' });
		expect(pairs(result.entries)).toEqual([['A', 15], ['B', 5]]);
	});

	it.each([
		['a null', null],
		['an absent', undefined],
	])('keeps %s value out of the mean denominator', (_label, missing) => {
		const rows = [{ c: 'A', v: 10 }, { c: 'A', v: 20 }, { c: 'A', v: missing }];
		const result = aggregateBarData(rows, 'c', { ...countArgs, measureMode: 'mean', valueColumn: 'v' });
		// Counting the blank would divide 30 by 3 and report 10.
		expect(pairs(result.entries)).toEqual([['A', 15]]);
	});

	it('does not invent a zero-value category from blank cells in sum mode', () => {
		const rows = [{ c: 'A', v: 10 }, { c: 'B', v: null }];
		const result = aggregateBarData(rows, 'c', { ...countArgs, measureMode: 'sum', valueColumn: 'v' });
		expect(pairs(result.entries)).toEqual([['A', 10]]);
	});

	it('fails with no-value-column for sum/mean without a usable column', () => {
		expect(aggregateBarData([{ c: 'A' }], 'c', { ...countArgs, measureMode: 'sum', valueColumn: null }))
			.toEqual({ ok: false, reason: 'no-value-column' });
		expect(aggregateBarData([{ c: 'A' }], 'c', { ...countArgs, measureMode: 'mean', valueColumn: 'missing' }))
			.toEqual({ ok: false, reason: 'no-value-column' });
	});

	it('fails with no-numeric when sum mode finds no parseable numbers', () => {
		const rows = [{ c: 'A', v: 'x' }, { c: 'B', v: 'y' }];
		expect(aggregateBarData(rows, 'c', { ...countArgs, measureMode: 'sum', valueColumn: 'v' }))
			.toEqual({ ok: false, reason: 'no-numeric' });
	});

	it('fails (no reason) on empty count input', () => {
		expect(aggregateBarData([], 'c', countArgs)).toEqual({ ok: false });
	});

	it('trims to Top-N and totals over the trimmed entries (post-trim base)', () => {
		const rows = [{ c: 'A' }, { c: 'A' }, { c: 'A' }, { c: 'B' }, { c: 'B' }, { c: 'C' }];
		const result = aggregateBarData(rows, 'c', { ...countArgs, topN: 2 });
		expect(pairs(result.entries)).toEqual([['A', 3], ['B', 2]]);
		expect(result.total).toBe(5);
	});
});
