import { describe, expect, it } from 'vitest';
import { normalizeBarOptions } from '../../../src/charts/bar/options.js';
import { BAR_CHART } from '../../../src/config/charts/definitions/bar.js';
import { CHART_COLORS, CHART_DIMENSIONS } from '../../../src/config/charts/definitions.js';

describe('normalizeBarOptions', () => {
	it('applies defaults for an empty config', () => {
		const o = normalizeBarOptions({});
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
		expect(normalizeBarOptions({ [key]: value })[key]).toBe(value);
		expect(normalizeBarOptions({})[key]).toBeUndefined();
	});

	it('coerces topN from string and keeps a negative value (no-trim sentinel)', () => {
		expect(normalizeBarOptions({ topN: '3' }).topN).toBe(3);
		expect(normalizeBarOptions({ topN: -1 }).topN).toBe(-1);
		expect(normalizeBarOptions({ topN: 'x' }).topN).toBe(BAR_CHART.defaultTopN);
	});

	it('falls back invalid colors', () => {
		expect(normalizeBarOptions({ color: 'nope' }).color).toBe(CHART_COLORS.bar);
		// gradientMinColor falls back to the (already-validated) base color.
		expect(normalizeBarOptions({ color: '#123456', gradientMinColor: 'bad' }).gradientMinColor).toBe('#123456');
	});

	it('clamps manualThresholdPct to 0..100 and chartHeight to 220..720', () => {
		expect(normalizeBarOptions({ manualThresholdPct: -5 }).manualThresholdPct).toBe(0);
		expect(normalizeBarOptions({ manualThresholdPct: 250 }).manualThresholdPct).toBe(100);
		expect(normalizeBarOptions({ chartHeight: 50 }).chartHeight).toBe(220);
		expect(normalizeBarOptions({ chartHeight: 9000 }).chartHeight).toBe(720);
	});
});
