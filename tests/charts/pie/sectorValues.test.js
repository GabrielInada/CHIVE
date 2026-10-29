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

	// A global filter such as "v > 0" can leave such a total above 0, and the
	// chart then draws the category, so the grid keeps a color for it.
	it('keeps a category whose total is 0 or less', () => {
		const dataset = { rows: [{ c: 'A', v: 5 }, { c: 'B', v: -3 }, { c: 'C', v: 2 }] };
		expect(keys(getPieSectorValues(dataset, sumConfig))).toEqual(['A', 'C', 'B']);
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
	const excludeA = { rules: [{ column: 'c', mode: 'categorical', include: [], exclude: ['v:A'] }], combine: 'AND' };

	function swatchDataset(globalFilter) {
		const rows = ['A', 'A', 'A', 'B', 'B', 'C'].map(c => ({ c }));
		return { rows, columns: [{ name: 'c', type: 'text' }], chartConfig: { globalFilter } };
	}

	function swatchConfig(overrides = {}) {
		return { category: 'c', measureMode: 'count', topN: 0, topNMode: 'other', color: BASE, customSliceColors: {}, ...overrides };
	}

	it('gives every drawn sector the shade the chart draws it with', () => {
		expect(getPieSwatchColors(swatchDataset(), swatchConfig())).toEqual({
			A: BASE,
			B: buildSliceColor(BASE, 1),
			C: buildSliceColor(BASE, 2),
		});
	});

	// Shades follow the drawn order, so a global filter that hides the largest
	// sector moves every other sector up one shade on the chart.
	it('follows the chart when a global filter hides a larger sector', () => {
		expect(getPieSwatchColors(swatchDataset(excludeA), swatchConfig())).toEqual({
			B: BASE,
			C: buildSliceColor(BASE, 1),
		});
	});

	it('keeps the custom color of a sector the chart does not draw', () => {
		const config = swatchConfig({ customSliceColors: { A: '#123456' } });
		expect(getPieSwatchColors(swatchDataset(excludeA), config).A).toBe('#123456');
	});

	it('leaves sectors past Top-N and the Other sector without a color', () => {
		const colors = getPieSwatchColors(swatchDataset(), swatchConfig({ topN: 1 }));
		expect(colors).toEqual({ A: BASE });
	});

	it('leaves a category whose total is 0 or less without a color', () => {
		const dataset = {
			rows: [{ c: 'A', v: 5 }, { c: 'B', v: -3 }, { c: 'C', v: 2 }],
			columns: [{ name: 'c', type: 'text' }, { name: 'v', type: 'number' }],
			chartConfig: {},
		};
		expect(getPieSwatchColors(dataset, swatchConfig({ measureMode: 'sum', valueColumn: 'v' }))).toEqual({
			A: BASE,
			C: buildSliceColor(BASE, 1),
		});
	});

	it('colors a category that a global filter leaves above 0', () => {
		// B sums to -5 over every row and to 10 once the filter drops v <= 0.
		const dataset = {
			rows: [{ c: 'A', v: 5 }, { c: 'B', v: 10 }, { c: 'B', v: -15 }],
			columns: [{ name: 'c', type: 'text' }, { name: 'v', type: 'number' }],
			chartConfig: { globalFilter: { rules: [{ column: 'v', operator: 'gt', value: 0 }], combine: 'AND' } },
		};
		const config = swatchConfig({ measureMode: 'sum', valueColumn: 'v' });
		expect(keys(getPieSectorValues(dataset, config))).toEqual(['A', 'B']);
		expect(getPieSwatchColors(dataset, config)).toEqual({ B: BASE, A: buildSliceColor(BASE, 1) });
	});

	it('applies a global-filter rule while the column list hides its column, like the chart does', () => {
		const dataset = { ...swatchDataset(excludeA), selectedColumns: [] };
		expect(getPieSwatchColors(dataset, swatchConfig())).toEqual({
			B: BASE,
			C: buildSliceColor(BASE, 1),
		});
	});

	it('returns no colors without a category or rows', () => {
		expect(getPieSwatchColors(swatchDataset(), swatchConfig({ category: null }))).toEqual({});
		expect(getPieSwatchColors({ rows: null, chartConfig: {} }, swatchConfig())).toEqual({});
	});
});
