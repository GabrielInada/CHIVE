import { describe, expect, it } from 'vitest';
import { buildSliceColor, resolveSliceColors } from '../../../src/charts/pie/color.js';
import { CHART_COLORS } from '../../../src/config/charts/definitions.js';
import { PIE_CHART } from '../../../src/config/charts/definitions/pie.js';

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

describe('pie resolveSliceColors', () => {
	it('gives Other its fixed color, then a custom color, then the shade for the sector position', () => {
		const entries = [{ key: 'A' }, { key: 'B' }, { key: 'C' }, { key: 'rest', isOther: true }];
		const colors = resolveSliceColors(entries, { color: '#888888', customSliceColors: { B: '#123456', rest: '#ff0000' } });
		expect([...colors]).toEqual([
			['A', '#888888'],
			['B', '#123456'],
			['C', buildSliceColor('#888888', 2)],
			['rest', PIE_CHART.otherSliceColor],
		]);
	});

	it('treats absent custom colors as none', () => {
		const colors = resolveSliceColors([{ key: 'A' }], { color: '#888888', customSliceColors: null });
		expect(colors.get('A')).toBe('#888888');
	});
});
