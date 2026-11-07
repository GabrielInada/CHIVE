import { describe, expect, it } from 'vitest';
import { normalizeBarOptions } from '../../../src/charts/bar/options.js';
import { BAR_CHART } from '../../../src/config/charts/definitions/bar.js';
import { CHART_COLORS, CHART_DIMENSIONS } from '../../../src/config/charts/definitions.js';

describe('normalizeBarOptions', () => {
	it('applies defaults for an empty options bag', () => {
		const o = normalizeBarOptions({}, 'region');
		expect(o.topN).toBe(BAR_CHART.defaultTopN);
		expect(o.showXAxisLabel).toBe(true);
		expect(o.showYAxisLabel).toBe(true);
		expect(o.valueColumn).toBeNull();
		expect(o.color).toBe(CHART_COLORS.bar);
		expect(o.gradientMaxColor).toBe('#ffffff');
		expect(o.manualThresholdPct).toBe(50);
		expect(o.customTitle).toBe('');
		expect(o.chartHeight).toBe(CHART_DIMENSIONS.bar.height);
	});

	// Chart config canonicalization checks the enumerated settings against the
	// chart's definition, so the normalizer reads them as given.
	it.each([
		['sort', 'label-asc'],
		['measureMode', 'mean'],
		['colorMode', 'gradient-manual'],
		['gradientDistribution', 'rank'],
	])('reads %s as given', (key, value) => {
		expect(normalizeBarOptions({ [key]: value }, 'region')[key]).toBe(value);
		expect(normalizeBarOptions({}, 'region')[key]).toBeUndefined();
	});

	it('derives the default x label from the category column and the y label from the measure label', () => {
		expect(normalizeBarOptions({}, 'region').axisLabels.x).toBe('region');
		expect(normalizeBarOptions({ measureMode: 'mean', labels: { measure: 'Média' } }, 'region').axisLabels.y).toBe('Média');
		expect(normalizeBarOptions({ measureMode: 'sum' }, 'region').axisLabels.y).toBe('Value');
		expect(normalizeBarOptions({ axisLabels: { x: 'X!', y: 'Y!' } }, 'region').axisLabels).toEqual({ x: 'X!', y: 'Y!' });
	});

	it('coerces topN from string and keeps a negative value (no-trim sentinel)', () => {
		expect(normalizeBarOptions({ topN: '3' }, 'c').topN).toBe(3);
		expect(normalizeBarOptions({ topN: -1 }, 'c').topN).toBe(-1);
		expect(normalizeBarOptions({ topN: 'x' }, 'c').topN).toBe(BAR_CHART.defaultTopN);
	});

	it('falls back invalid colors', () => {
		expect(normalizeBarOptions({ color: 'nope' }, 'c').color).toBe(CHART_COLORS.bar);
		// gradientMinColor falls back to the (already-validated) base color.
		expect(normalizeBarOptions({ color: '#123456', gradientMinColor: 'bad' }, 'c').gradientMinColor).toBe('#123456');
	});

	it('clamps manualThresholdPct to 0..100 and chartHeight to 220..720', () => {
		expect(normalizeBarOptions({ manualThresholdPct: -5 }, 'c').manualThresholdPct).toBe(0);
		expect(normalizeBarOptions({ manualThresholdPct: 250 }, 'c').manualThresholdPct).toBe(100);
		expect(normalizeBarOptions({ chartHeight: 50 }, 'c').chartHeight).toBe(220);
		expect(normalizeBarOptions({ chartHeight: 9000 }, 'c').chartHeight).toBe(720);
	});

	it('passes through caller labels', () => {
		expect(normalizeBarOptions({ labels: { measure: 'Contagem' } }, 'c').labels.measure).toBe('Contagem');
	});
});
