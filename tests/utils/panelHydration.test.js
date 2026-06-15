import { describe, expect, it } from 'vitest';
import { rehydratePanelChartSpecs } from '../../src/utils/panelHydration.js';

describe('rehydratePanelChartSpecs', () => {
	it('returns null/undefined panels untouched', () => {
		expect(rehydratePanelChartSpecs(null)).toBeNull();
		expect(rehydratePanelChartSpecs(undefined)).toBeUndefined();
	});

	it('returns the panel unchanged when charts is not an array', () => {
		const noCharts = { id: 'p1', title: 'Panel' };
		expect(rehydratePanelChartSpecs(noCharts)).toBe(noCharts);

		const badCharts = { id: 'p1', charts: 'nope' };
		expect(rehydratePanelChartSpecs(badCharts)).toBe(badCharts);
	});

	it('passes through specs that are null or lack a type', () => {
		const typeless = { id: 'c1', config: { category: 'region' } };
		const panel = { id: 'p1', charts: [null, typeless] };
		const result = rehydratePanelChartSpecs(panel);
		expect(result.charts[0]).toBeNull();
		// Untyped specs are returned by reference, not re-merged.
		expect(result.charts[1]).toBe(typeless);
	});

	it('re-merges a saved spec config against current defaults', () => {
		const panel = {
			id: 'p1',
			charts: [{ id: 'c1', type: 'bar', config: { category: 'region', topN: 5 } }],
		};
		const result = rehydratePanelChartSpecs(panel);
		const config = result.charts[0].config;

		// User-set fields survive the merge.
		expect(config.category).toBe('region');
		expect(config.topN).toBe(5);
		// Default keys absent from the saved spec are now present.
		expect(config.colorMode).toBe('uniform');
		expect(config.showXAxisLabel).toBe(true);
	});

	it('fills a full default config when a spec has no config', () => {
		const panel = { id: 'p1', charts: [{ id: 'c1', type: 'treemap' }] };
		const result = rehydratePanelChartSpecs(panel);
		const config = result.charts[0].config;

		expect(config.measureMode).toBeDefined();
		expect(config.colorMode).toBe('scheme');
		expect(config.showLabels).toBe(true);
	});

	it('preserves non-config spec fields', () => {
		const panel = {
			id: 'p1',
			charts: [{ id: 'c1', type: 'bar', title: 'Sales', config: {} }],
		};
		const result = rehydratePanelChartSpecs(panel);
		expect(result.charts[0].id).toBe('c1');
		expect(result.charts[0].type).toBe('bar');
		expect(result.charts[0].title).toBe('Sales');
	});

	it('handles an empty charts array', () => {
		const panel = { id: 'p1', charts: [] };
		const result = rehydratePanelChartSpecs(panel);
		expect(result.charts).toEqual([]);
	});

	it('does not mutate the original panel or its specs', () => {
		const originalConfig = { category: 'region' };
		const panel = { id: 'p1', charts: [{ id: 'c1', type: 'bar', config: originalConfig }] };
		rehydratePanelChartSpecs(panel);
		// Original spec config object is left as the caller supplied it.
		expect(panel.charts[0].config).toBe(originalConfig);
		expect(originalConfig).toEqual({ category: 'region' });
	});
});
