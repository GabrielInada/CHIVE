import { describe, expect, it } from 'vitest';
import { mergePanelSnapshotConfigsWithDefaults } from '../../../src/domain/panel/rehydration.js';

describe('mergePanelSnapshotConfigsWithDefaults', () => {
	it('returns null/undefined panels untouched', () => {
		expect(mergePanelSnapshotConfigsWithDefaults(null)).toBeNull();
		expect(mergePanelSnapshotConfigsWithDefaults(undefined)).toBeUndefined();
	});

	it('returns the panel unchanged when charts is not an array', () => {
		const noCharts = { id: 'p1', title: 'Panel' };
		expect(mergePanelSnapshotConfigsWithDefaults(noCharts)).toBe(noCharts);

		const badCharts = { id: 'p1', charts: 'nope' };
		expect(mergePanelSnapshotConfigsWithDefaults(badCharts)).toBe(badCharts);
	});

	it('passes through snapshots that are null or lack a type', () => {
		const typeless = { id: 'c1', config: { category: 'region' } };
		const panel = { id: 'p1', charts: [null, typeless] };
		const result = mergePanelSnapshotConfigsWithDefaults(panel);
		expect(result.charts[0]).toBeNull();
		// Untyped snapshots are returned by reference, not re-merged.
		expect(result.charts[1]).toBe(typeless);
	});

	it('re-merges a saved snapshot config against current defaults', () => {
		const panel = {
			id: 'p1',
			charts: [{ id: 'c1', type: 'bar', config: { category: 'region', topN: 5 } }],
		};
		const result = mergePanelSnapshotConfigsWithDefaults(panel);
		const config = result.charts[0].config;

		// User-set fields survive the merge.
		expect(config.category).toBe('region');
		expect(config.topN).toBe(5);
		// Default keys absent from the saved snapshot are now present.
		expect(config.colorMode).toBe('uniform');
		expect(config.showXAxisLabel).toBe(true);
	});

	it.each([
		['count-desc', 'value-desc'],
		['count-asc', 'value-asc'],
	])('migrates the saved Panel sort %s while preserving its capture', (legacySort, sort) => {
		const config = Object.freeze({ category: 'region', measureMode: 'sum', valueColumn: 'sales', sort: legacySort });
		const dataSnapshot = [{ region: 'North', sales: 12 }];
		const columnsSnapshot = [{ name: 'region', type: 'text' }, { name: 'sales', type: 'number' }];
		const snapshot = Object.freeze({ id: 'c1', type: 'bar', config, dataSnapshot, columnsSnapshot });
		const panel = { charts: [snapshot], slots: { left: 'c1' } };
		const result = mergePanelSnapshotConfigsWithDefaults(panel);

		expect(result.charts[0].config).toMatchObject({ category: 'region', measureMode: 'sum', valueColumn: 'sales', sort });
		expect(result.charts[0].dataSnapshot).toBe(dataSnapshot);
		expect(result.charts[0].columnsSnapshot).toBe(columnsSnapshot);
		expect(result.slots).toEqual(panel.slots);
		expect(config.sort).toBe(legacySort);
		expect(mergePanelSnapshotConfigsWithDefaults(result)).toEqual(result);
	});

	it('re-merges a saved scatter3d snapshot against the new chart defaults', () => {
		const panel = {
			id: 'p1',
			charts: [{ id: 'c1', type: 'scatter3d', config: { x: 'width', y: 'height', z: 'depth', pointSize: 0.08 } }],
		};
		const result = mergePanelSnapshotConfigsWithDefaults(panel);
		const config = result.charts[0].config;

		// User-set fields survive the merge.
		expect(config.x).toBe('width');
		expect(config.pointSize).toBe(0.08);
		// Default keys absent from the saved snapshot are now present.
		expect(config.opacity).toBeDefined();
		expect(config.color).toBeDefined();
		expect(config.chartHeight).toBe(460);
	});

	it('replaces a saved measure the chart does not offer with its default', () => {
		const panel = {
			id: 'p1',
			charts: [{ id: 'c1', type: 'pie', config: { category: 'region', measureMode: 'mean', valueColumn: 'sales' } }],
		};
		const config = mergePanelSnapshotConfigsWithDefaults(panel).charts[0].config;

		expect(config.measureMode).toBe('count');
		expect(config.category).toBe('region');
		expect(config.valueColumn).toBe('sales');
	});

	it('fills a full default config when a snapshot has no config', () => {
		const panel = { id: 'p1', charts: [{ id: 'c1', type: 'treemap' }] };
		const result = mergePanelSnapshotConfigsWithDefaults(panel);
		const config = result.charts[0].config;

		expect(config.measureMode).toBeDefined();
		expect(config.colorMode).toBe('scheme');
		expect(config.showLabels).toBe(true);
	});

	it('preserves non-config snapshot fields', () => {
		const panel = {
			id: 'p1',
			charts: [{ id: 'c1', type: 'bar', title: 'Sales', config: {} }],
		};
		const result = mergePanelSnapshotConfigsWithDefaults(panel);
		expect(result.charts[0].id).toBe('c1');
		expect(result.charts[0].type).toBe('bar');
		expect(result.charts[0].title).toBe('Sales');
	});

	it('handles an empty charts array', () => {
		const panel = { id: 'p1', charts: [] };
		const result = mergePanelSnapshotConfigsWithDefaults(panel);
		expect(result.charts).toEqual([]);
	});

	it('does not mutate the original panel or its snapshots', () => {
		const originalConfig = { category: 'region' };
		const panel = { id: 'p1', charts: [{ id: 'c1', type: 'bar', config: originalConfig }] };
		mergePanelSnapshotConfigsWithDefaults(panel);
		// Original snapshot config object is left as the caller supplied it.
		expect(panel.charts[0].config).toBe(originalConfig);
		expect(originalConfig).toEqual({ category: 'region' });
	});
});
