import { describe, expect, it } from 'vitest';
import { createDefaultChartConfig } from '../../src/config/chartDefaults.js';
import { CHART_TYPE_KEYS } from '../../src/config/chartTypes.js';

describe('chartDefaults', () => {
	describe('createDefaultChartConfig', () => {
		it('returns config with all chart type sections', () => {
			const config = createDefaultChartConfig();
			expect(config).toHaveProperty('activeTab', 'preview');
			for (const type of CHART_TYPE_KEYS) {
				expect(config).toHaveProperty(type);
			}
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
			for (const type of CHART_TYPE_KEYS) {
				expect(config[type].enabled).toBe(false);
			}
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
			for (const type of CHART_TYPE_KEYS) {
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
});
