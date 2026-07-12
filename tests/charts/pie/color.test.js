import { describe, expect, it } from 'vitest';
import { buildSliceColor } from '../../../src/charts/pie/color.js';
import { CHART_COLORS } from '../../../src/config/charts.js';

describe('pie buildSliceColor', () => {
	it('returns the base shade at index 0 and darkens by index', () => {
		const base = '#888888';
		const c0 = buildSliceColor(base, 0);
		const c1 = buildSliceColor(base, 1);
		expect(c0).toBe('#888888');
		expect(c1).not.toBe(c0);
	});

	it('caps the darkening at 8 steps', () => {
		const base = '#888888';
		expect(buildSliceColor(base, 9)).toBe(buildSliceColor(base, 8));
	});

	it('falls back to the default pie base color when the base does not parse', () => {
		expect(buildSliceColor('not-a-color', 0)).toBe(CHART_COLORS.pie);
	});
});
