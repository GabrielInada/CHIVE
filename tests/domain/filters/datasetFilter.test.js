import { describe, expect, it } from 'vitest';
import { filterDataset } from '../../../src/domain/filters/datasetFilter.js';

const rows = [
	{ region: 'North', product: 'a', sales: 10 },
	{ region: 'South', product: 'b', sales: 20 },
	{ region: 'North', product: 'c', sales: 30 },
];
const columns = [
	{ name: 'region', type: 'text' },
	{ name: 'product', type: 'text' },
	{ name: 'sales', type: 'number' },
];
const keepNorth = {
	rules: [{ column: 'region', mode: 'categorical', include: ['v:North'], exclude: [] }],
	combine: 'AND',
};

describe('filterDataset', () => {
	it('applies a rule while the column list hides its column', () => {
		const dataset = { rows, columns, selectedColumns: ['product'], chartConfig: { globalFilter: keepNorth } };
		expect(filterDataset(dataset).rows.map(row => row.product)).toEqual(['a', 'c']);
	});

	it('reads a rule on a number column as numeric, hidden or not', () => {
		const overFifteen = { rules: [{ column: 'sales', mode: 'numeric', operator: 'gt', value: '15' }], combine: 'AND' };
		const dataset = { rows, columns, selectedColumns: ['region'], chartConfig: { globalFilter: overFifteen } };
		expect(filterDataset(dataset).rows.map(row => row.sales)).toEqual([20, 30]);
	});

	it('returns the rules it applied', () => {
		const { filter } = filterDataset({ rows, columns, chartConfig: { globalFilter: keepNorth } });
		expect(filter.rules).toEqual([expect.objectContaining({ column: 'region', include: ['v:North'] })]);
	});

	it('drops a rule whose column the dataset no longer has', () => {
		const gone = { rules: [{ column: 'country', mode: 'categorical', include: ['v:BR'], exclude: [] }], combine: 'AND' };
		const result = filterDataset({ rows, columns, chartConfig: { globalFilter: gone } });
		expect(result.filter.rules).toEqual([]);
		expect(result.rows).toBe(rows);
	});

	// The stats view reuses the precomputed stats only for the dataset's own rows array.
	it("returns the dataset's own rows array when no rule applies", () => {
		expect(filterDataset({ rows, columns, chartConfig: {} }).rows).toBe(rows);
		expect(filterDataset({ rows, columns }).rows).toBe(rows);
	});
});
