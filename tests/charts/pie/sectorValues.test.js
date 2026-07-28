import { describe, expect, it } from 'vitest';
import { getPieSectorValues } from '../../../src/charts/pie/controls/sectorValues.js';
import { aggregatePieData } from '../../../src/charts/pie/data.js';

const sumConfig = { category: 'c', measureMode: 'sum', valueColumn: 'v', topN: 0 };

describe('getPieSectorValues', () => {
	it('orders categories by descending aggregate with a string tiebreak', () => {
		const dataset = {
			rows: [
				{ c: 'A', v: 5 },
				{ c: 'B', v: 20 },
				{ c: 'A', v: 5 },
				{ c: 'C', v: 10 },
			],
		};
		expect(getPieSectorValues(dataset, sumConfig)).toEqual(['B', 'A', 'C']);
	});

	it.each([
		['empty string', ''],
		['whitespace', '   '],
		['null', null],
	])('ignores a %s value instead of adding zero to the sum', (_label, missing) => {
		const dataset = { rows: [{ c: 'A', v: 10 }, { c: 'A', v: missing }, { c: 'B', v: 4 }] };
		expect(getPieSectorValues(dataset, sumConfig)).toEqual(['A', 'B']);
	});

	it('drops a category whose every value is blank rather than ranking it at zero', () => {
		const dataset = { rows: [{ c: 'A', v: 10 }, { c: 'B', v: '' }] };
		expect(getPieSectorValues(dataset, sumConfig)).toEqual(['A']);
	});

	// The controls readout and the rendered chart must agree, or the per-slice
	// color grid maps colors onto sectors the chart never draws.
	it('agrees with aggregatePieData on which categories survive blank values', () => {
		const rows = [
			{ c: 'A', v: 10 },
			{ c: 'A', v: '' },
			{ c: 'B', v: 4 },
			{ c: 'C', v: null },
		];

		const controlOrder = getPieSectorValues({ rows }, sumConfig);
		const chart = aggregatePieData(rows, 'c', {
			measureMode: 'sum',
			valueColumn: 'v',
			topN: 0,
			topNMode: 'other',
			otherLabel: 'Other',
		});

		expect(chart.ok).toBe(true);
		expect(controlOrder).toEqual(chart.entries.map(entry => entry.category));
	});

	it('counts every row, blank or not, in count mode', () => {
		const dataset = { rows: [{ c: 'A', v: '' }, { c: 'A', v: 1 }, { c: 'B', v: 9 }] };
		const countConfig = { category: 'c', measureMode: 'count', valueColumn: null, topN: 0 };
		expect(getPieSectorValues(dataset, countConfig)).toEqual(['A', 'B']);
	});

	it('returns an empty list without a category or rows', () => {
		expect(getPieSectorValues({ rows: [] }, { ...sumConfig, category: null })).toEqual([]);
		expect(getPieSectorValues(null, sumConfig)).toEqual([]);
	});
});
