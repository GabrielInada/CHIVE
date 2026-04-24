import { describe, expect, it } from 'vitest';
import { createDefaultChartConfig, mergeChartConfigWithDefaults } from '../../src/config/chartDefaults.js';

describe('chartDefaults', () => {
	describe('createDefaultChartConfig', () => {
		it('returns config with all chart type sections', () => {
			const config = createDefaultChartConfig();
			expect(config).toHaveProperty('aba', 'preview');
			expect(config).toHaveProperty('bar');
			expect(config).toHaveProperty('scatter');
			expect(config).toHaveProperty('network');
			expect(config).toHaveProperty('pie');
			expect(config).toHaveProperty('bubble');
		});

		it('initializes all chart types as disabled', () => {
			const config = createDefaultChartConfig();
			expect(config.bar.enabled).toBe(false);
			expect(config.scatter.enabled).toBe(false);
			expect(config.network.enabled).toBe(false);
			expect(config.pie.enabled).toBe(false);
			expect(config.bubble.enabled).toBe(false);
		});

		it('includes an empty multi-rule globalFilter at config root', () => {
			const config = createDefaultChartConfig();
			expect(config.globalFilter).toEqual({
				rules: [],
				combine: 'AND',
			});
		});

		it('does not duplicate filter shape per chart type', () => {
			const config = createDefaultChartConfig();
			for (const type of ['bar', 'scatter', 'network', 'pie', 'bubble', 'treemap']) {
				expect(config[type].filter).toBeUndefined();
			}
		});

		it('returns independent instances on each call', () => {
			const a = createDefaultChartConfig();
			const b = createDefaultChartConfig();
			a.bar.color = '#000';
			expect(b.bar.color).not.toBe('#000');
		});
	});

	describe('mergeChartConfigWithDefaults', () => {
		it('returns full defaults when config is null', () => {
			const result = mergeChartConfigWithDefaults(null);
			const defaults = createDefaultChartConfig();
			expect(result.aba).toBe(defaults.aba);
			expect(result.bar.enabled).toBe(false);
		});

		it('returns full defaults when config is undefined', () => {
			const result = mergeChartConfigWithDefaults(undefined);
			expect(result.bar).toBeDefined();
			expect(result.scatter).toBeDefined();
		});

		it('merges partial bar config with defaults', () => {
			const result = mergeChartConfigWithDefaults({
				bar: { enabled: true, color: '#ff0000' },
			});
			expect(result.bar.enabled).toBe(true);
			expect(result.bar.color).toBe('#ff0000');
			expect(result.bar.sort).toBeDefined();
		});

		it('merges partial scatter config with defaults', () => {
			const result = mergeChartConfigWithDefaults({
				scatter: { x: 'colA', y: 'colB' },
			});
			expect(result.scatter.x).toBe('colA');
			expect(result.scatter.y).toBe('colB');
			expect(result.scatter.radius).toBeDefined();
			expect(result.scatter.categoricalPairMode).toBe('jitter');
		});

		it('merges partial network config with defaults', () => {
			const result = mergeChartConfigWithDefaults({
				network: { source: 'src', target: 'tgt' },
			});
			expect(result.network.source).toBe('src');
			expect(result.network.nodeRadius).toBeDefined();
		});

		it('merges partial pie config with defaults', () => {
			const result = mergeChartConfigWithDefaults({
				pie: { category: 'type', measureMode: 'sum' },
			});
			expect(result.pie.category).toBe('type');
			expect(result.pie.measureMode).toBe('sum');
			expect(result.pie.innerRadius).toBeDefined();
		});

		it('merges partial bubble config with defaults', () => {
			const result = mergeChartConfigWithDefaults({
				bubble: { category: 'type', measureMode: 'mean', valueColumn: 'valor' },
			});
			expect(result.bubble.category).toBe('type');
			expect(result.bubble.measureMode).toBe('mean');
			expect(result.bubble.valueColumn).toBe('valor');
			expect(result.bubble.padding).toBeDefined();
		});

		it('preserves top-level overrides like aba', () => {
			const result = mergeChartConfigWithDefaults({ aba: 'bar' });
			expect(result.aba).toBe('bar');
		});

		it('handles empty object config', () => {
			const result = mergeChartConfigWithDefaults({});
			const defaults = createDefaultChartConfig();
			expect(result.bar.enabled).toBe(defaults.bar.enabled);
		});

		it('fills an empty rules globalFilter when missing from legacy configs', () => {
			const result = mergeChartConfigWithDefaults({ bar: { enabled: true } });
			expect(result.globalFilter).toEqual({ rules: [], combine: 'AND' });
		});

		it('migrates a legacy single-filter globalFilter to a one-rule array', () => {
			const result = mergeChartConfigWithDefaults({
				globalFilter: { column: 'age', operator: 'gt', value: '30' },
			});
			expect(result.globalFilter.rules).toHaveLength(1);
			expect(result.globalFilter.rules[0].column).toBe('age');
			expect(result.globalFilter.rules[0].operator).toBe('gt');
			expect(result.globalFilter.combine).toBe('AND');
		});

		it('preserves multi-rule globalFilter provided by caller', () => {
			const result = mergeChartConfigWithDefaults({
				globalFilter: {
					rules: [
						{ column: 'age', operator: 'gt', value: '30' },
						{ column: 'region', mode: 'categorical', include: ['v:N'] },
					],
				},
			});
			expect(result.globalFilter.rules).toHaveLength(2);
			expect(result.globalFilter.rules[0].column).toBe('age');
			expect(result.globalFilter.rules[1].column).toBe('region');
		});
	});
});
