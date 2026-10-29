import { describe, expect, it } from 'vitest';
import { aggregateCategories } from '../../../src/charts/shared/categoryAggregation.js';
import { MISSING_KEY, MISSING_TOKEN } from '../../../src/domain/datasets/cellValues.js';
import { applyChartFilterRows } from '../../../src/domain/filters/chartFilter.js';

const count = { measureMode: 'count', valueColumn: null };
const sum = { measureMode: 'sum', valueColumn: 'v' };
const mean = { measureMode: 'mean', valueColumn: 'v' };
const pairs = result => result.entries.map(entry => [entry.key, entry.value]);

describe('aggregateCategories', () => {
	it('counts rows per category, largest first, with ties by category key', () => {
		const rows = [{ c: 'B' }, { c: 'C' }, { c: 'A' }, { c: 'C' }, { c: 'A' }, { c: 'C' }];
		const result = aggregateCategories(rows, 'c', count);
		expect(result.ok).toBe(true);
		expect(pairs(result)).toEqual([['C', 3], ['A', 2], ['B', 1]]);
	});

	it('orders the missing bucket last among equal values', () => {
		const rows = [{ c: null }, { c: 'B' }, { c: 'A' }];
		expect(pairs(aggregateCategories(rows, 'c', count))).toEqual([['A', 1], ['B', 1], [MISSING_KEY, 1]]);
	});

	it('buckets missing cells apart from literal N/A text, with the given missing label', () => {
		const rows = [{ c: 'A' }, { c: null }, { c: 'N/A' }, {}];
		const { entries } = aggregateCategories(rows, 'c', { ...count, missingLabel: '(sem valor)' });
		expect(entries.find(entry => entry.key === MISSING_KEY))
			.toMatchObject({ label: '(sem valor)', token: MISSING_TOKEN, value: 2 });
		expect(entries.find(entry => entry.key === 'N/A')).toMatchObject({ label: 'N/A', token: 'v:N/A', value: 1 });
	});

	it('hides exactly the missing rows through the missing bucket token', () => {
		const rows = [{ c: 'A' }, { c: null }, { c: 'N/A' }, { c: null }];
		const missing = aggregateCategories(rows, 'c', count).entries.find(entry => entry.key === MISSING_KEY);
		expect(applyChartFilterRows(rows, { column: 'c', exclude: [missing.token] })).toEqual([{ c: 'A' }, { c: 'N/A' }]);
	});

	it('sums the value column and skips missing values', () => {
		const rows = [{ c: 'A', v: 10 }, { c: 'A', v: null }, { c: 'B', v: 4 }, { c: 'B', v: 3 }, { c: 'A', v: 2 }];
		expect(pairs(aggregateCategories(rows, 'c', sum))).toEqual([['A', 12], ['B', 7]]);
	});

	it.each([
		['a null', null],
		['an absent', undefined],
	])('keeps %s value out of the mean denominator', (_label, missing) => {
		const rows = [{ c: 'A', v: 10 }, { c: 'A', v: 20 }, { c: 'A', v: missing }, { c: 'B', v: 5 }];
		// Counting the blank would divide 30 by 3 and report 10.
		expect(pairs(aggregateCategories(rows, 'c', mean))).toEqual([['A', 15], ['B', 5]]);
	});

	it('does not invent a category from rows whose value is missing', () => {
		const rows = [{ c: 'A', v: 10 }, { c: 'B', v: null }];
		expect(pairs(aggregateCategories(rows, 'c', sum))).toEqual([['A', 10]]);
	});

	it('reads only number cells, not text that looks like a number', () => {
		const rows = [{ c: 'A', v: 5 }, { c: 'A', v: '12' }, { c: 'B', v: '3' }];
		expect(pairs(aggregateCategories(rows, 'c', sum))).toEqual([['A', 5]]);
	});

	it('counts rows for a measure other than sum or mean', () => {
		const rows = [{ c: 'A', v: 10 }, { c: 'A', v: 20 }];
		expect(pairs(aggregateCategories(rows, 'c', { measureMode: 'median', valueColumn: 'v' }))).toEqual([['A', 2]]);
	});

	it('keeps the first row counted toward each category', () => {
		const rows = [{ c: 'A', v: null }, { c: 'A', v: 1 }, { c: 'A', v: 2 }];
		expect(aggregateCategories(rows, 'c', count).entries[0].firstRow).toBe(rows[0]);
		expect(aggregateCategories(rows, 'c', sum).entries[0].firstRow).toBe(rows[1]);
	});

	it.each([
		['sum without a value column', { measureMode: 'sum', valueColumn: null }],
		['mean on a column no row has', { measureMode: 'mean', valueColumn: 'absent' }],
	])('fails with no-value-column for %s', (_label, measure) => {
		expect(aggregateCategories([{ c: 'A', v: 1 }], 'c', measure)).toEqual({ ok: false, reason: 'no-value-column' });
	});

	it.each([
		['sum', sum],
		['mean', mean],
	])('fails with no-numeric when %s finds no number in the value column', (_label, measure) => {
		const rows = [{ c: 'A', v: null }, { c: 'B', v: 'x' }];
		expect(aggregateCategories(rows, 'c', measure)).toEqual({ ok: false, reason: 'no-numeric' });
	});

	it('fails with no reason when there are no rows to count', () => {
		expect(aggregateCategories([], 'c', count)).toEqual({ ok: false });
	});
});
