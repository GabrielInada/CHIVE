import { describe, expect, it } from 'vitest';
import { getPieSectorValues, getPieSwatchColors } from '../../../src/charts/pie/controls/sectorValues.js';
import { buildSliceColor } from '../../../src/charts/pie/color.js';
import { aggregatePieData } from '../../../src/charts/pie/data.js';
import { MISSING_KEY } from '../../../src/domain/datasets/cellValues.js';

const sumConfig = { category: 'c', measureMode: 'sum', valueColumn: 'v', topN: 0 };
const keys = sectors => sectors.map(sector => sector.key);

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
		expect(keys(getPieSectorValues(dataset, sumConfig))).toEqual(['B', 'A', 'C']);
	});

	it.each([
		['a null', null],
		['an absent', undefined],
	])('ignores %s value instead of adding zero to the sum', (_label, missing) => {
		const dataset = { rows: [{ c: 'A', v: 10 }, { c: 'A', v: missing }, { c: 'B', v: 4 }] };
		expect(keys(getPieSectorValues(dataset, sumConfig))).toEqual(['A', 'B']);
	});

	it('drops a category whose every value is blank rather than ranking it at zero', () => {
		const dataset = { rows: [{ c: 'A', v: 10 }, { c: 'B', v: null }] };
		expect(keys(getPieSectorValues(dataset, sumConfig))).toEqual(['A']);
	});

	// The controls readout and the rendered chart must agree, or the per-slice
	// color grid maps colors onto sectors the chart never draws.
	it('agrees with aggregatePieData on which categories survive blank values', () => {
		const rows = [
			{ c: 'A', v: 10 },
			{ c: 'A', v: null },
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
		expect(keys(controlOrder)).toEqual(chart.entries.map(entry => entry.key));
	});

	it('counts every row, blank or not, in count mode', () => {
		const dataset = { rows: [{ c: 'A', v: null }, { c: 'A', v: 1 }, { c: 'B', v: 9 }] };
		const countConfig = { category: 'c', measureMode: 'count', valueColumn: null, topN: 0 };
		expect(keys(getPieSectorValues(dataset, countConfig))).toEqual(['A', 'B']);
	});

	it('keys the missing sector and labels it for the color grid', () => {
		const dataset = { rows: [{ c: 'A' }, { c: null }, { c: 'N/A' }] };
		const countConfig = { category: 'c', measureMode: 'count', valueColumn: null, topN: 0 };
		expect(getPieSectorValues(dataset, countConfig, { missingLabel: '(sem valor)' })).toEqual([
			{ key: 'A', label: 'A' },
			{ key: 'N/A', label: 'N/A' },
			{ key: MISSING_KEY, label: '(sem valor)' },
		]);
	});

	it('returns an empty list without a category or rows', () => {
		expect(getPieSectorValues({ rows: [] }, { ...sumConfig, category: null })).toEqual([]);
		expect(getPieSectorValues(null, sumConfig)).toEqual([]);
	});
});

describe('getPieSwatchColors', () => {
	const BASE = '#888888';
	const columns = { columnNames: ['c'], numericColumnNames: [] };
	const excludeA = { rules: [{ column: 'c', mode: 'categorical', include: [], exclude: ['v:A'] }], combine: 'AND' };

	function swatchDataset(globalFilter) {
		const rows = ['A', 'A', 'A', 'B', 'B', 'C'].map(c => ({ c }));
		return { rows, chartConfig: { globalFilter } };
	}

	function swatchConfig(overrides = {}) {
		return { category: 'c', measureMode: 'count', topN: 0, topNMode: 'other', color: BASE, customSliceColors: {}, ...overrides };
	}

	it('gives every drawn sector the shade the chart draws it with', () => {
		expect(getPieSwatchColors(swatchDataset(), swatchConfig(), columns)).toEqual({
			A: BASE,
			B: buildSliceColor(BASE, 1),
			C: buildSliceColor(BASE, 2),
		});
	});

	// Shades follow the drawn order, so a global filter that hides the largest
	// sector moves every other sector up one shade on the chart.
	it('follows the chart when a global filter hides a larger sector', () => {
		expect(getPieSwatchColors(swatchDataset(excludeA), swatchConfig(), columns)).toEqual({
			B: BASE,
			C: buildSliceColor(BASE, 1),
		});
	});

	it('keeps the custom color of a sector the chart does not draw', () => {
		const config = swatchConfig({ customSliceColors: { A: '#123456' } });
		expect(getPieSwatchColors(swatchDataset(excludeA), config, columns).A).toBe('#123456');
	});

	it('leaves sectors past Top-N and the Other sector without a color', () => {
		const colors = getPieSwatchColors(swatchDataset(), swatchConfig({ topN: 1 }), columns);
		expect(colors).toEqual({ A: BASE });
	});

	it('ignores a global-filter rule on a column the chart cannot see, like the chart does', () => {
		const colors = getPieSwatchColors(swatchDataset(excludeA), swatchConfig(), { columnNames: [], numericColumnNames: [] });
		expect(colors.A).toBe(BASE);
	});

	it('returns no colors without a category or rows', () => {
		expect(getPieSwatchColors(swatchDataset(), swatchConfig({ category: null }), columns)).toEqual({});
		expect(getPieSwatchColors({ rows: null, chartConfig: {} }, swatchConfig(), columns)).toEqual({});
	});
});
