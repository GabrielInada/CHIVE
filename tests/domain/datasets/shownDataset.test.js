import { describe, expect, it } from 'vitest';
import { deriveShownDataset } from '../../../src/domain/datasets/shownDataset.js';
import { canonicalizeChartConfig } from '../../../src/domain/charts/chartConfig.js';

const rows = [
	{ region: 'North', day: '2024-01-01', sales: 10 },
	{ region: 'South', day: '2024-01-02', sales: 20 },
	{ region: 'North', day: '2024-01-03', sales: 30 },
];
const columns = [
	{ name: 'region', type: 'text' },
	{ name: 'day', type: 'date' },
	{ name: 'sales', type: 'number' },
];
const keepNorth = {
	rules: [{ column: 'region', mode: 'categorical', include: ['v:North'], exclude: [] }],
	combine: 'AND',
};

/** A dataset as state stores it: its chart config is canonical. */
function makeDataset({ selectedColumns = columns.map(column => column.name), chartConfig = {} } = {}) {
	return {
		id: 'sales',
		name: 'sales.csv',
		rows,
		columns,
		selectedColumns,
		chartConfig: canonicalizeChartConfig(chartConfig, columns.map(column => column.name)),
	};
}

describe('deriveShownDataset', () => {
	it('keeps the rows that pass the global filter, with a rule on a hidden column', () => {
		const shown = deriveShownDataset(makeDataset({ selectedColumns: ['sales'], chartConfig: { globalFilter: keepNorth } }));

		expect(shown.rows.map(row => row.sales)).toEqual([10, 30]);
		expect(shown.filter.rules).toEqual([expect.objectContaining({ column: 'region', include: ['v:North'] })]);
	});

	// The stats view reuses the precomputed stats only for the dataset's own rows array.
	it("returns the dataset's own rows array when no rule applies", () => {
		const dataset = makeDataset();
		expect(deriveShownDataset(dataset).rows).toBe(dataset.rows);
	});

	it('lists the columns the column list shows, in source order', () => {
		const shown = deriveShownDataset(makeDataset({ selectedColumns: ['sales', 'region'] }));
		expect(shown.visibleColumns.map(column => column.name)).toEqual(['region', 'sales']);
	});

	it('types every column, hidden ones included', () => {
		const shown = deriveShownDataset(makeDataset({ selectedColumns: ['sales'] }));
		expect(shown.columnTypeByName).toEqual({ region: 'text', day: 'date', sales: 'number' });
	});

	it('picks the first enabled chart in canonical order', () => {
		expect(deriveShownDataset(makeDataset()).activeChartType).toBeNull();
		expect(deriveShownDataset(makeDataset({ chartConfig: { pie: { enabled: true } } })).activeChartType).toBe('pie');
		// A legacy config can enable more than one chart; the first one is drawn.
		const legacy = makeDataset({ chartConfig: { pie: { enabled: true }, line: { enabled: true } } });
		expect(deriveShownDataset(legacy).activeChartType).toBe('line');
	});

	it('hands on the dataset and its stored chart config without copying or repairing them', () => {
		const dataset = makeDataset({ chartConfig: { bar: { enabled: true, color: '#123456' } } });
		const storedConfig = dataset.chartConfig;
		const before = structuredClone(storedConfig);

		const shown = deriveShownDataset(dataset);

		expect(shown.dataset).toBe(dataset);
		expect(dataset.chartConfig).toBe(storedConfig);
		expect(dataset.chartConfig).toEqual(before);
	});

	it('shows no columns and no chart for a dataset without columns or config', () => {
		const shown = deriveShownDataset({ rows, columns: undefined, chartConfig: undefined });

		expect(shown.rows).toBe(rows);
		expect(shown.visibleColumns).toEqual([]);
		expect(shown.columnTypeByName).toEqual({});
		expect(shown.activeChartType).toBeNull();
	});
});
