import { describe, expect, it } from 'vitest';
import { aggregateCategories } from '../../../src/charts/shared/categoryAggregation.js';
import { MISSING_KEY, MISSING_TOKEN } from '../../../src/domain/datasets/cellValues.js';
import { applyFilterRuleToRows } from '../../../src/domain/filters/filterRule.js';

const count = { measureMode: 'count', valueColumn: null };
const sum = { measureMode: 'sum', valueColumn: 'v' };
const mean = { measureMode: 'mean', valueColumn: 'v' };
const measures = { count, sum, mean };
const pairs = result => result.entries.map(entry => [entry.key, entry.value]);

// Per category: count C 3, B 2, D 2, A 1, E 1.
// Sum: A 9, B 4, C 3, D 0, E -2. Mean: A 9, B 2, C 1, D 0, E -2.
const mixed = [
	{ c: 'A', v: 9 },
	{ c: 'B', v: 1 },
	{ c: 'B', v: 3 },
	{ c: 'C', v: 1 },
	{ c: 'C', v: 1 },
	{ c: 'C', v: 1 },
	{ c: 'D', v: 5 },
	{ c: 'D', v: -5 },
	{ c: 'E', v: -2 },
];

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
		expect(applyFilterRuleToRows(rows, { column: 'c', exclude: [missing.token] })).toEqual([{ c: 'A' }, { c: 'N/A' }]);
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

describe('the categories a chart draws', () => {
	it('keeps every value, 0 and below included, unless only positive values can be drawn', () => {
		expect(pairs(aggregateCategories(mixed, 'c', sum))).toEqual([['A', 9], ['B', 4], ['C', 3], ['D', 0], ['E', -2]]);
	});

	it.each([
		['count', count, [['C', 3], ['B', 2], ['D', 2], ['A', 1], ['E', 1]]],
		['sum', sum, [['A', 9], ['B', 4], ['C', 3]]],
		['mean', mean, [['A', 9], ['B', 2], ['C', 1]]],
	])('leaves out a %s at or below 0 when only positive values can be drawn', (_label, measure, expected) => {
		expect(pairs(aggregateCategories(mixed, 'c', { ...measure, positiveOnly: true }))).toEqual(expected);
	});

	it.each([
		['sum', sum],
		['mean', mean],
	])('fails with no-positive-value when no %s is above 0 and only positive values can be drawn', (_label, measure) => {
		const rows = [{ c: 'A', v: -1 }, { c: 'B', v: 0 }];
		expect(aggregateCategories(rows, 'c', { ...measure, positiveOnly: true }))
			.toEqual({ ok: false, reason: 'no-positive-value' });
	});

	it.each([
		['count', {}, [['C', 3], ['B', 2]], 4],
		['sum', {}, [['A', 9], ['B', 4]], 1],
		['sum', { positiveOnly: true }, [['A', 9], ['B', 4]], 3],
		['mean', { positiveOnly: true }, [['A', 9], ['B', 2]], 1],
	])('keeps the first two of a %s with %j and sums what the cut leaves out', (measureMode, options, expected, rest) => {
		const result = aggregateCategories(mixed, 'c', { ...measures[measureMode], ...options, topN: 2 });
		expect(pairs(result)).toEqual(expected);
		expect(result.omittedValueTotal).toBe(rest);
	});

	it('breaks a tie at the cut by category key, with the missing bucket last', () => {
		const rows = [{ c: null }, { c: 'Z' }, { c: 'Y' }];
		const result = aggregateCategories(rows, 'c', { ...count, topN: 2 });
		expect(pairs(result)).toEqual([['Y', 1], ['Z', 1]]);
		expect(result.omittedValueTotal).toBe(1);
	});

	it.each([
		['no limit', 0],
		['a negative limit', -1],
		['a limit as large as the categories', 5],
		['a limit beyond them', 10],
	])('leaves nothing out with %s', (_label, topN) => {
		const result = aggregateCategories(mixed, 'c', { ...sum, topN });
		expect(result.entries).toHaveLength(5);
		expect(result.omittedValueTotal).toBeNull();
	});

	it.each([
		['count', { topN: 2 }, 5],
		['sum', {}, 14],
		['sum', { positiveOnly: true, topN: 2 }, 13],
		['mean', { positiveOnly: true }, 12],
	])('totals the %s of the categories it keeps with %j, without the rest', (measureMode, options, total) => {
		expect(aggregateCategories(mixed, 'c', { ...measures[measureMode], ...options }).retainedValueTotal).toBe(total);
	});

	it.each([
		['value-desc', ['C', 'B', 'D'], 2],
		['value-asc', ['A', 'E', 'B'], 5],
		['label-asc', ['A', 'B', 'C'], 3],
		['label-desc', ['E', 'D', 'C'], 3],
	])('orders by %s before the cut', (sort, expected, rest) => {
		const result = aggregateCategories(mixed, 'c', { ...count, sort, topN: 3 });
		expect(result.entries.map(entry => entry.key)).toEqual(expected);
		expect(result.omittedValueTotal).toBe(rest);
	});

	it.each([
		['sum', 'value-desc', ['A', 'B', 'C']],
		['sum', 'value-asc', ['E', 'D', 'C']],
		['mean', 'value-desc', ['A', 'B', 'C']],
		['mean', 'value-asc', ['E', 'D', 'C']],
	])('orders the %s by %s before Top-N, independently of counts', (measureMode, sort, expected) => {
		const result = aggregateCategories(mixed, 'c', { ...measures[measureMode], sort, topN: 3 });
		expect(result.entries.map(entry => entry.key)).toEqual(expected);
	});

	it.each([
		['label-asc', ['A', 'B', MISSING_KEY]],
		['label-desc', ['B', 'A', MISSING_KEY]],
	])('keeps the missing bucket last in %s', (sort, expected) => {
		const rows = [{ c: null }, { c: 'B' }, { c: 'A' }];
		expect(aggregateCategories(rows, 'c', { ...count, sort }).entries.map(entry => entry.key)).toEqual(expected);
	});

	it.each([undefined, 'constructor'])('keeps the largest first for the order %s', sort => {
		expect(aggregateCategories(mixed, 'c', { ...count, sort }).entries.map(entry => entry.key))
			.toEqual(['C', 'B', 'D', 'A', 'E']);
	});
});
