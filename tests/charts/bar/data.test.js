import { describe, expect, it } from 'vitest';
import { aggregateBarData } from '../../../src/charts/bar/data.js';

const countArgs = { measureMode: 'count', valueColumn: null, sort: 'count-desc', topN: 0 };

describe('aggregateBarData', () => {
	it('counts rows per category, descending with a string tiebreak', () => {
		const rows = [{ c: 'B' }, { c: 'A' }, { c: 'A' }, { c: 'A' }, { c: 'B' }, { c: 'C' }];
		const result = aggregateBarData(rows, 'c', countArgs);
		expect(result.ok).toBe(true);
		expect(result.entries).toEqual([['A', 3], ['B', 2], ['C', 1]]);
		expect(result.total).toBe(6);
	});

	it('buckets null/empty categories into N/A', () => {
		const rows = [{ c: 'A' }, { c: null }, { c: '' }];
		const naEntry = aggregateBarData(rows, 'c', countArgs).entries.find(([name]) => name === 'N/A');
		expect(naEntry).toEqual(['N/A', 2]);
	});

	it('honors each sort mode', () => {
		const rows = [{ c: 'A' }, { c: 'A' }, { c: 'B' }, { c: 'C' }, { c: 'C' }, { c: 'C' }];
		const names = (sort) => aggregateBarData(rows, 'c', { ...countArgs, sort }).entries.map(e => e[0]);
		expect(names('count-desc')).toEqual(['C', 'A', 'B']);
		expect(names('count-asc')).toEqual(['B', 'A', 'C']);
		expect(names('label-asc')).toEqual(['A', 'B', 'C']);
		expect(names('label-desc')).toEqual(['C', 'B', 'A']);
	});

	it('sums a numeric value column and skips non-finite values', () => {
		const rows = [{ c: 'A', v: 10 }, { c: 'A', v: 'x' }, { c: 'B', v: 4 }];
		const result = aggregateBarData(rows, 'c', { ...countArgs, measureMode: 'sum', valueColumn: 'v' });
		expect(result.entries).toEqual([['A', 10], ['B', 4]]);
	});

	it('averages per category in mean mode', () => {
		const rows = [{ c: 'A', v: 10 }, { c: 'A', v: 20 }, { c: 'B', v: 5 }];
		const result = aggregateBarData(rows, 'c', { ...countArgs, measureMode: 'mean', valueColumn: 'v' });
		expect(result.entries).toEqual([['A', 15], ['B', 5]]);
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
		expect(result.entries).toEqual([['A', 3], ['B', 2]]);
		expect(result.total).toBe(5);
	});
});
