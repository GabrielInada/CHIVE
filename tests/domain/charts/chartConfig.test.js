import { describe, expect, it } from 'vitest';
import { canonicalizeChartConfig, mergeChartConfigWithDefaults } from '../../../src/domain/charts/chartConfig.js';
import { createDefaultChartConfig } from '../../../src/config/charts/defaults.js';
import { CHART_DEFINITIONS, CHART_TYPE_KEYS } from '../../../src/config/charts/definitions.js';

function enumeratedSettings(allowedValues, path) {
	return Object.entries(allowedValues).flatMap(([key, offered]) => {
		const keys = [...path, key];
		return Array.isArray(offered)
			? [[keys.join('.'), keys, offered]]
			: enumeratedSettings(offered, keys);
	});
}

const ENUMERATED_SETTINGS = Object.values(CHART_DEFINITIONS)
	.flatMap(({ key, allowedValues }) => enumeratedSettings(allowedValues, [key]));
const readSetting = (config, keys) => keys.reduce((block, key) => block[key], config);
const savedSetting = (keys, value) => keys.reduceRight((block, key) => ({ [key]: block }), value);

describe('chartConfig', () => {
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

		it.each([
			['count-desc', 'value-desc'],
			['count-asc', 'value-asc'],
		])('migrates saved bar sort %s without changing its direction', (legacySort, sort) => {
			for (const measureMode of ['count', 'sum', 'mean']) {
				const bar = Object.freeze({ sort: legacySort, measureMode, valueColumn: 'sales', topN: 5 });
				const saved = Object.freeze({ bar });
				const result = mergeChartConfigWithDefaults(saved);

				expect(result.bar).toMatchObject({ sort, measureMode, valueColumn: 'sales', topN: 5 });
				expect(canonicalizeChartConfig(result)).toEqual(result);
				expect(saved.bar).toBe(bar);
				expect(saved.bar.sort).toBe(legacySort);
			}
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

		describe('enumerated settings', () => {
			const defaults = createDefaultChartConfig();
			it.each(ENUMERATED_SETTINGS)('keeps every offered %s value', (_name, keys, offered) => {
				for (const value of offered) {
					const result = mergeChartConfigWithDefaults(savedSetting(keys, value));
					expect(readSetting(result, keys)).toBe(value);
				}
			});

			it.each(ENUMERATED_SETTINGS)('replaces invalid %s values with the default', (_name, keys) => {
				for (const value of ['bogus', null, undefined, 1, 'toString', 'constructor', '__proto__']) {
					const result = mergeChartConfigWithDefaults(savedSetting(keys, value));
					expect(readSetting(result, keys), String(value)).toBe(readSetting(defaults, keys));
				}
			});

			it('replaces nested regression mode while preserving its siblings and the input', () => {
				const regression = Object.freeze({ mode: 'bogus', enabled: true, showCI: false, degree: 3, color: '#123456' });
				const saved = { scatter: { regression, x: 'age', colorScheme: 'Pastel' } };
				const result = mergeChartConfigWithDefaults(saved);
				expect(result.scatter.regression).toEqual({ ...defaults.scatter.regression, ...regression, mode: 'overall' });
				expect(result.scatter).toMatchObject({ x: 'age', colorScheme: 'Pastel' });
				expect(saved.scatter.regression).toBe(regression);
				expect(regression.mode).toBe('bogus');
			});

			it('replaces only the value the chart does not offer and leaves the saved block untouched', () => {
				const saved = { pie: { measureMode: 'mean', category: 'region', colorScheme: 'Bold' } };
				const result = mergeChartConfigWithDefaults(saved);
				expect(result.pie).toMatchObject({ measureMode: 'count', category: 'region', colorScheme: 'Bold' });
				expect(saved.pie).toEqual({ measureMode: 'mean', category: 'region', colorScheme: 'Bold' });
			});
		});
	});

	describe('canonicalizeChartConfig', () => {
		it('fills all chart blocks from a partial config', () => {
			const result = canonicalizeChartConfig({ bar: { enabled: true } }, ['a']);
			expect(result.bar.enabled).toBe(true);
			expect(result.bar.sort).toBeDefined();
			for (const type of CHART_TYPE_KEYS) {
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

		it('replaces a measure the chart does not offer with the chart default', () => {
			const result = canonicalizeChartConfig({ treemap: { measureMode: 'mean', valueColumn: 'v' } }, ['v']);
			expect(result.treemap.measureMode).toBe('count');
			expect(result.treemap.valueColumn).toBe('v');
		});

		it.each(ENUMERATED_SETTINGS)('is idempotent after replacing invalid %s', (_name, keys) => {
			const once = canonicalizeChartConfig(savedSetting(keys, 'bogus'));
			expect(canonicalizeChartConfig(once)).toEqual(once);
		});

		it('is idempotent with migrations and filter trimming', () => {
			const input = {
				bubble: { groupColumn: 'grupo' },
				pie: { measureMode: 'mean' },
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
