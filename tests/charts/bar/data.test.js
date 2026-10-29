import { describe, expect, it } from 'vitest';
import { aggregateBarData } from '../../../src/charts/bar/data.js';
import { MISSING_KEY } from '../../../src/domain/datasets/cellValues.js';

const countArgs = { measureMode: 'count', valueColumn: null, sort: 'count-desc', topN: 0, missingLabel: '(missing)' };
const pairs = entries => entries.map(entry => [entry.key, entry.value]);

describe('aggregateBarData', () => {
	it('measures categories through the shared category aggregation', () => {
		const rows = [{ c: 'A', v: 10 }, { c: 'A', v: 20 }, { c: null, v: 5 }];
		const result = aggregateBarData(rows, 'c', {
			...countArgs, measureMode: 'mean', valueColumn: 'v', missingLabel: '(sem valor)',
		});
		expect(result.entries.map(({ key, label, value }) => [key, label, value]))
			.toEqual([['A', 'A', 15], [MISSING_KEY, '(sem valor)', 5]]);
		expect(result.total).toBe(20);
	});

	it('passes the shared failures through', () => {
		expect(aggregateBarData([{ c: 'A' }], 'c', { ...countArgs, measureMode: 'sum', valueColumn: null }))
			.toEqual({ ok: false, reason: 'no-value-column' });
		expect(aggregateBarData([], 'c', countArgs)).toEqual({ ok: false });
	});

	it('honors each sort mode', () => {
		const rows = [{ c: 'A' }, { c: 'A' }, { c: 'B' }, { c: 'C' }, { c: 'C' }, { c: 'C' }];
		const names = (sort) => aggregateBarData(rows, 'c', { ...countArgs, sort }).entries.map(e => e.key);
		expect(names('count-desc')).toEqual(['C', 'A', 'B']);
		expect(names('count-asc')).toEqual(['B', 'A', 'C']);
		expect(names('label-asc')).toEqual(['A', 'B', 'C']);
		expect(names('label-desc')).toEqual(['C', 'B', 'A']);
	});

	it('keeps the missing bucket last in both label sorts', () => {
		const rows = [{ c: 'B' }, { c: null }, { c: 'A' }];
		const keys = sort => aggregateBarData(rows, 'c', { ...countArgs, sort }).entries.map(entry => entry.key);
		expect(keys('label-asc')).toEqual(['A', 'B', MISSING_KEY]);
		expect(keys('label-desc')).toEqual(['B', 'A', MISSING_KEY]);
	});

	it('trims to Top-N after sorting and totals over the trimmed entries (post-trim base)', () => {
		const rows = [{ c: 'A' }, { c: 'A' }, { c: 'A' }, { c: 'B' }, { c: 'B' }, { c: 'C' }];
		const result = aggregateBarData(rows, 'c', { ...countArgs, topN: 2 });
		expect(pairs(result.entries)).toEqual([['A', 3], ['B', 2]]);
		expect(result.total).toBe(5);
		expect(pairs(aggregateBarData(rows, 'c', { ...countArgs, sort: 'count-asc', topN: 2 }).entries))
			.toEqual([['C', 1], ['B', 2]]);
	});
});
