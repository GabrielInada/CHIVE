import { describe, expect, it } from 'vitest';
import { canonicalizeChartConfig, createDefaultChartConfig, mergeChartConfigWithDefaults } from '../../src/config/chartDefaults.js';

describe('chartDefaults', () => {
	describe('createDefaultChartConfig', () => {
		it('returns config with all chart type sections', () => {
			const config = createDefaultChartConfig();
			expect(config).toHaveProperty('activeTab', 'preview');
			expect(config).toHaveProperty('bar');
			expect(config).toHaveProperty('scatter');
			expect(config).toHaveProperty('network');
			expect(config).toHaveProperty('pie');
			expect(config).toHaveProperty('bubble');
			expect(config).toHaveProperty('line');
		});

		it('initializes line chart with curve/missingMode defaults and disabled', () => {
			const config = createDefaultChartConfig();
			expect(config.line.enabled).toBe(false);
			expect(config.line.curve).toBe('linear');
			expect(config.line.missingMode).toBe('connect');
			expect(config.line.sortX).toBe(true);
			expect(config.line.aggregateMode).toBe('none');
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

		it('uses Colorblind-Safe as the accessibility-first default palette', () => {
			const config = createDefaultChartConfig();
			expect(config.bar.colorScheme).toBe('Colorblind-Safe');
			expect(config.scatter.colorScheme).toBe('Colorblind-Safe');
			expect(config.network.colorScheme).toBe('Colorblind-Safe');
			expect(config.pie.colorScheme).toBe('Colorblind-Safe');
			expect(config.treemap.colorScheme).toBe('Colorblind-Safe');
		});

		it('includes pie topN/topNMode defaults that preserve existing behavior', () => {
			const config = createDefaultChartConfig();
			expect(config.pie.topN).toBe(0);
			expect(config.pie.topNMode).toBe('other');
		});
	});

	describe('mergeChartConfigWithDefaults', () => {
		it('returns full defaults when config is null', () => {
			const result = mergeChartConfigWithDefaults(null);
			const defaults = createDefaultChartConfig();
			expect(result.activeTab).toBe(defaults.activeTab);
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

		it('merges partial line config with defaults', () => {
			const result = mergeChartConfigWithDefaults({
				line: { x: 'date', y: 'visits', curve: 'monotone' },
			});
			expect(result.line.x).toBe('date');
			expect(result.line.y).toBe('visits');
			expect(result.line.curve).toBe('monotone');
			expect(result.line.missingMode).toBe('connect');
			expect(result.line.strokeWidth).toBeDefined();
		});

		it('preserves top-level overrides like activeTab', () => {
			const result = mergeChartConfigWithDefaults({ activeTab: 'bar' });
			expect(result.activeTab).toBe('bar');
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

		it('preserves a previously-saved Bold colorScheme without migrating it', () => {
			const result = mergeChartConfigWithDefaults({
				bar: { colorScheme: 'Bold' },
				pie: { colorScheme: 'Bold' },
			});
			expect(result.bar.colorScheme).toBe('Bold');
			expect(result.pie.colorScheme).toBe('Bold');
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

		describe('malformed-shape hardening', () => {
			const defaults = createDefaultChartConfig();

			it('treats a non-object string config as no saved config', () => {
				const result = mergeChartConfigWithDefaults('bad');
				expect(result.bar).toEqual(defaults.bar);
				expect(result).not.toHaveProperty('0');
			});

			it('treats a top-level array config as no saved config (plain-object guard, not typeof)', () => {
				const result = mergeChartConfigWithDefaults([]);
				expect(result.bar).toEqual(defaults.bar);
				expect(result).not.toHaveProperty('0');
			});

			it('falls back to defaults for a non-object chart block', () => {
				const result = mergeChartConfigWithDefaults({ bar: 'bad' });
				expect(result.bar).toEqual(defaults.bar);
				expect(result.bar).not.toHaveProperty('0');
			});

			it('falls back to defaults for a non-object nested scatter.regression', () => {
				const result = mergeChartConfigWithDefaults({ scatter: { regression: 'bad' } });
				expect(result.scatter.regression).toEqual(defaults.scatter.regression);
			});

			it('falls back to defaults for an array chart block', () => {
				const result = mergeChartConfigWithDefaults({ pie: [] });
				expect(result.pie).toEqual(defaults.pie);
				expect(result.pie).not.toHaveProperty('0');
			});
		});
	});

	describe('canonicalizeChartConfig', () => {
		it('fills all chart blocks from a partial config', () => {
			const result = canonicalizeChartConfig({ bar: { enabled: true } }, ['a']);
			expect(result.bar.enabled).toBe(true);
			expect(result.bar.sort).toBeDefined();
			for (const type of ['scatter', 'scatter3d', 'network', 'pie', 'bubble', 'treemap', 'line', 'tin']) {
				expect(result[type]).toBeDefined();
			}
		});

		it('promotes a legacy bubble groupColumn into nestingColumns', () => {
			const result = canonicalizeChartConfig({ bubble: { groupColumn: 'grupo' } }, ['grupo']);
			expect(result.bubble.nestingColumns).toEqual(['grupo']);
		});

		it('migrates a legacy single-filter globalFilter to a one-rule array', () => {
			const result = canonicalizeChartConfig(
				{ globalFilter: { column: 'age', operator: 'gt', value: '30' } },
				['age'],
			);
			expect(result.globalFilter.rules).toHaveLength(1);
			expect(result.globalFilter.rules[0].column).toBe('age');
		});

		it('trims filter rules whose column is absent while keeping valid ones', () => {
			const result = canonicalizeChartConfig(
				{
					globalFilter: {
						rules: [
							{ column: 'age', operator: 'gt', value: '30' },
							{ column: 'gone', mode: 'categorical', include: ['v:N'] },
						],
					},
				},
				['age'],
			);
			expect(result.globalFilter.rules).toHaveLength(1);
			expect(result.globalFilter.rules[0].column).toBe('age');
		});

		it('keeps normalized filter rules when columnNames is omitted (does not drop them)', () => {
			const result = canonicalizeChartConfig({
				globalFilter: { rules: [{ column: 'gone', mode: 'categorical', include: ['v:N'] }] },
			});
			expect(result.globalFilter.rules).toHaveLength(1);
			expect(result.globalFilter.rules[0].column).toBe('gone');
		});

		it('is idempotent', () => {
			const input = {
				bubble: { groupColumn: 'grupo' },
				globalFilter: {
					rules: [
						{ column: 'age', operator: 'gt', value: '30' },
						{ column: 'gone', mode: 'categorical', include: ['v:N'] },
					],
				},
			};
			const once = canonicalizeChartConfig(input, ['age', 'grupo']);
			const twice = canonicalizeChartConfig(once, ['age', 'grupo']);
			expect(twice).toEqual(once);
		});

		describe('malformed-shape hardening', () => {
			const defaults = createDefaultChartConfig();

			it('falls back to defaults for a string config', () => {
				const result = canonicalizeChartConfig('bad', ['a']);
				expect(result.bar).toEqual(defaults.bar);
				expect(result).not.toHaveProperty('0');
			});

			it('falls back to defaults for a top-level array config', () => {
				const result = canonicalizeChartConfig([], ['a']);
				expect(result.bar).toEqual(defaults.bar);
				expect(result).not.toHaveProperty('0');
			});

			it('falls back to defaults for non-object chart blocks', () => {
				const result = canonicalizeChartConfig(
					{ bar: 'bad', scatter: { regression: 'bad' }, pie: [] },
					['a'],
				);
				expect(result.bar).toEqual(defaults.bar);
				expect(result.scatter.regression).toEqual(defaults.scatter.regression);
				expect(result.pie).toEqual(defaults.pie);
			});
		});
	});
});
