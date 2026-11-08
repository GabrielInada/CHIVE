import { describe, expect, it } from 'vitest';
import { normalizePieOptions } from '../../../src/charts/pie/options.js';
import { CHART_COLORS, CHART_DIMENSIONS } from '../../../src/config/charts/definitions.js';
import { PIE_CHART } from '../../../src/config/charts/definitions/pie.js';

describe('normalizePieOptions', () => {
	it('applies defaults for an empty config', () => {
		const o = normalizePieOptions({});
		expect(o.color).toBe(CHART_COLORS.pie);
		expect(o.valueColumn).toBeNull();
		expect(o.topN).toBe(0);
		expect(o.showCategoryLabel).toBe(true);
		expect(o.showValueLabel).toBe(true);
		expect(o.showLegend).toBe(true);
		expect(o.customTitle).toBe('');
		expect(o.chartHeight).toBe(CHART_DIMENSIONS.pie.height);
		expect(o.customSliceColors).toEqual({});
		expect(o.padAngleRad).toBeCloseTo((PIE_CHART.defaultPadAngle * Math.PI) / 180);
	});

	it('falls back to the default pie color when the color is invalid', () => {
		expect(normalizePieOptions({ color: 'bogus' }).color).toBe(CHART_COLORS.pie);
		expect(normalizePieOptions({ color: '#abcdef' }).color).toBe('#abcdef');
	});

	// Chart config canonicalization checks the enumerated settings against the
	// chart's definition, so the normalizer reads them as given.
	it.each([
		['measureMode', 'sum'],
		['topNMode', 'truncate'],
		['labelPosition', 'outside'],
	])('reads %s as given', (key, value) => {
		expect(normalizePieOptions({ [key]: value })[key]).toBe(value);
		expect(normalizePieOptions({})[key]).toBeUndefined();
	});

	it('coerces topN from string and keeps a negative value (no-trim sentinel) as-is', () => {
		expect(normalizePieOptions({ topN: '5' }).topN).toBe(5);
		expect(normalizePieOptions({ topN: -2 }).topN).toBe(-2);
		expect(normalizePieOptions({ topN: 'x' }).topN).toBe(0);
	});

	it('passes customSliceColors through raw (no hex validation on overrides)', () => {
		const customSliceColors = { A: '#fff', B: 'javascript:alert(1)' };
		expect(normalizePieOptions({ customSliceColors }).customSliceColors).toBe(customSliceColors);
	});

	it('clamps padAngle and zoomScale, and truncates a long title to 80 chars', () => {
		expect(normalizePieOptions({ padAngle: 9999 }).padAngleRad)
			.toBeCloseTo((PIE_CHART.maxPadAngle * Math.PI) / 180);
		expect(normalizePieOptions({ zoomScale: 9999 }).zoomScale).toBe(PIE_CHART.maxZoomScale);
		expect(normalizePieOptions({ zoomScale: -9999 }).zoomScale).toBe(PIE_CHART.minZoomScale);
		expect(normalizePieOptions({ customTitle: 'p'.repeat(120) }).customTitle).toHaveLength(80);
	});
});
