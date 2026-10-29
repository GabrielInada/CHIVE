import { describe, expect, it } from 'vitest';
import { buildSliceColor } from '../../../src/charts/pie/color.js';
import { OTHER_SECTOR_KEY, computePieSectors } from '../../../src/charts/pie/data.js';
import { CHART_COLORS } from '../../../src/config/charts/definitions.js';
import { PIE_CHART } from '../../../src/config/charts/definitions/pie.js';
import { MISSING_KEY, MISSING_TOKEN } from '../../../src/domain/datasets/cellValues.js';

const BASE = '#888888';
const countOptions = { measureMode: 'count', topN: 0, topNMode: 'other', color: BASE, labels: { other: 'Other' } };
const sumOptions = { ...countOptions, measureMode: 'sum', valueColumn: 'v' };
const values = sectors => sectors.map(({ key, value }) => [key, value]);
const fills = sectors => sectors.map(({ key, color }) => [key, color]);
// C01 to C12 with 12 down to 1 rows each.
const twelveCategories = Array.from({ length: 12 }, (_, index) => Array.from(
	{ length: 12 - index },
	() => ({ c: `C${String(index + 1).padStart(2, '0')}` }),
)).flat();

describe('computePieSectors', () => {
	it('sums categories through the shared category aggregation', () => {
		const rows = [{ c: 'A', v: 10 }, { c: 'A', v: 20 }, { c: null, v: 5 }];
		const result = computePieSectors(rows, 'c', { ...sumOptions, labels: { missing: '(sem valor)' } });
		expect(result.sectors.map(({ key, label, token, value }) => [key, label, token, value])).toEqual([
			['A', 'A', 'v:A', 30],
			[MISSING_KEY, '(sem valor)', MISSING_TOKEN, 5],
		]);
		expect(result.total).toBe(35);
	});

	it('counts rows for a measure other than sum, as the pie offers only count and sum', () => {
		const rows = [{ c: 'A', v: 10 }, { c: 'A', v: 20 }, { c: 'B', v: 50 }];
		const result = computePieSectors(rows, 'c', { ...countOptions, measureMode: 'mean', valueColumn: 'v' });
		expect(values(result.sectors)).toEqual([['A', 2], ['B', 1]]);
	});

	it('passes the shared failures through', () => {
		expect(computePieSectors([{ c: 'A' }], 'c', { ...sumOptions, valueColumn: null }))
			.toEqual({ ok: false, reason: 'no-value-column' });
		expect(computePieSectors([{ c: 'A', v: null }], 'c', sumOptions))
			.toEqual({ ok: false, reason: 'no-numeric' });
		expect(computePieSectors([], 'c', countOptions)).toEqual({ ok: false });
	});

	it('leaves out categories whose total is 0 or less', () => {
		const rows = [{ c: 'A', v: 5 }, { c: 'B', v: -3 }, { c: 'C', v: 2 }, { c: 'D', v: 0 }];
		const result = computePieSectors(rows, 'c', sumOptions);
		expect(values(result.sectors)).toEqual([['A', 5], ['C', 2]]);
		expect(result.total).toBe(7);
	});

	it.each([
		['every total negative', -5, -3],
		['the largest total 0', 0, -3],
		['every total 0', 0, 0],
	])('fails with no-positive-value with %s', (_label, a, b) => {
		const rows = [{ c: 'A', v: a }, { c: 'B', v: b }];
		expect(computePieSectors(rows, 'c', sumOptions)).toEqual({ ok: false, reason: 'no-positive-value' });
	});

	it('truncate mode drops the tail past Top-N', () => {
		const rows = ['A', 'A', 'A', 'B', 'B', 'C'].map(c => ({ c }));
		const result = computePieSectors(rows, 'c', { ...countOptions, topN: 2, topNMode: 'truncate' });
		expect(values(result.sectors)).toEqual([['A', 3], ['B', 2]]);
		expect(result.total).toBe(5);
	});

	it('other mode folds the tail into the Other sector, drawn last', () => {
		const rows = ['A', 'A', 'A', 'B', 'B', 'C', 'D'].map(c => ({ c }));
		const result = computePieSectors(rows, 'c', { ...countOptions, topN: 2, labels: { other: 'Outros' } });
		expect(result.sectors.at(-1)).toEqual({
			key: OTHER_SECTOR_KEY,
			label: 'Outros',
			token: null,
			value: 2,
			color: PIE_CHART.otherSliceColor,
			isOther: true,
		});
		expect(values(result.sectors)).toEqual([['A', 3], ['B', 2], [OTHER_SECTOR_KEY, 2]]);
		// The total covers every drawn sector, the Other sector included.
		expect(result.total).toBe(7);
	});

	it('keeps a real category spelled like the Other label apart from the Other sector', () => {
		const rows = ['Other', 'Other', 'Other', 'A', 'A', 'B', 'C'].map(c => ({ c }));
		const { sectors } = computePieSectors(rows, 'c', { ...countOptions, topN: 2 });
		expect(sectors.map(({ key, token, isOther }) => [key, token, isOther])).toEqual([
			['Other', 'v:Other', false],
			['A', 'v:A', false],
			[OTHER_SECTOR_KEY, null, true],
		]);
		expect(sectors[0].color).toBe(BASE);
	});

	it('folds only totals above 0 into the Other sector', () => {
		// T01 to T10 sum to 20 down to 11, T11 to 4 and T12 to -6.
		const rows = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 4, -6]
			.map((v, index) => ({ c: `T${String(index + 1).padStart(2, '0')}`, v }));
		const result = computePieSectors(rows, 'c', { ...sumOptions, topN: 10 });
		expect(values(result.sectors).at(-1)).toEqual([OTHER_SECTOR_KEY, 4]);
		expect(result.total).toBe(159);
	});

	it('makes no Other sector when only totals at or below 0 are past Top-N', () => {
		const rows = [{ c: 'A', v: 5 }, { c: 'B', v: -3 }, { c: 'C', v: 2 }];
		const result = computePieSectors(rows, 'c', { ...sumOptions, topN: 2 });
		expect(values(result.sectors)).toEqual([['A', 5], ['C', 2]]);
	});

	it('fills a category with its custom color, else the shade for its place in the drawn order', () => {
		const rows = ['A', 'A', 'A', 'B', 'B', 'C'].map(c => ({ c }));
		const result = computePieSectors(rows, 'c', { ...countOptions, customSliceColors: { B: '#123456' } });
		expect(fills(result.sectors)).toEqual([
			['A', BASE],
			['B', '#123456'],
			['C', buildSliceColor(BASE, 2)],
		]);
	});

	// A global filter that hides the largest category moves every other one
	// up a shade, and the chart and the color grid both see it here.
	it('shades the categories in the order they are drawn', () => {
		const rows = ['B', 'B', 'C'].map(c => ({ c }));
		expect(fills(computePieSectors(rows, 'c', countOptions).sectors)).toEqual([
			['B', BASE],
			['C', buildSliceColor(BASE, 1)],
		]);
	});

	it('spreads the shades over the category sectors past 9, leaving out the Other sector', () => {
		const result = computePieSectors(twelveCategories, 'c', { ...countOptions, topN: 10, customSliceColors: { C04: '#123456' } });
		const categorySectors = result.sectors.filter(sector => !sector.isOther);
		expect(categorySectors).toHaveLength(10);
		expect(new Set(result.sectors.map(sector => sector.color)).size).toBe(11);
		expect(categorySectors[3].color).toBe('#123456');
		expect(categorySectors[4].color).toBe(buildSliceColor(BASE, 4, 10));
		expect(result.sectors.at(-1).color).toBe(PIE_CHART.otherSliceColor);
	});

	it('gives the Other sector its fixed color even with a custom color under its key', () => {
		const rows = ['A', 'A', 'B', 'C'].map(c => ({ c }));
		const options = { ...countOptions, topN: 1, customSliceColors: { [OTHER_SECTOR_KEY]: '#ff0000' } };
		expect(computePieSectors(rows, 'c', options).sectors.at(-1).color).toBe(PIE_CHART.otherSliceColor);
	});

	// The color grid passes the saved config and the renderer its options bag,
	// so both have to read to the same sectors.
	it('reads the saved config as the renderer reads its options', () => {
		const savedConfig = { category: 'c', measureMode: 'mean', topN: '2', topNMode: 'bogus', color: 'not-a-color', customSliceColors: null };
		const renderOptions = { measureMode: 'count', topN: 2, topNMode: 'other', color: CHART_COLORS.pie, customSliceColors: {} };
		expect(computePieSectors(twelveCategories, 'c', savedConfig)).toEqual(computePieSectors(twelveCategories, 'c', renderOptions));
	});
});
