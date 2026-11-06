import { describe, expect, it } from 'vitest';
import { buildSliceColor } from '../../../src/charts/pie/color.js';
import { CHART_COLORS } from '../../../src/config/charts/definitions.js';

describe('pie buildSliceColor', () => {
	// The default base color's shades, each 8% darker than the one before.
	const STEPPED = ['#5f7c33', '#57722f', '#50682b', '#485e27', '#415423', '#394a1f', '#31401b', '#2a3716', '#222d12'];
	const shadesOf = (base, count) => Array.from({ length: count }, (_, index) => buildSliceColor(base, index, count));
	// On a white base, each channel over 255 is the brightness a shade keeps.
	const brightness = hex => parseInt(hex.slice(1, 3), 16) / 255;

	it('returns the base shade at index 0 and darkens by index', () => {
		const base = '#888888';
		const c0 = buildSliceColor(base, 0);
		const c1 = buildSliceColor(base, 1);
		expect(c0).toBe('#888888');
		expect(c1).not.toBe(c0);
	});

	it('keeps the 8% steps for 9 slices or fewer', () => {
		expect(shadesOf('#5f7c33', 9)).toEqual(STEPPED);
		expect(shadesOf('#5f7c33', 4)).toEqual(STEPPED.slice(0, 4));
		expect(buildSliceColor('#5f7c33', 3)).toBe(STEPPED[3]);
	});

	it.each([10, 11, 25, 50])('gives each of %i slices its own shade, from the base color to the 9th shade', count => {
		const shades = shadesOf('#5f7c33', count);
		expect(new Set(shades).size).toBe(count);
		expect(shades[0]).toBe(STEPPED[0]);
		expect(shades).toContain(STEPPED[8]);

		const levels = shadesOf('#ffffff', count).map(brightness);
		expect(Math.max(...levels)).toBe(1);
		expect(Math.min(...levels)).toBeCloseTo(0.36, 2);
	});

	it.each([10, 11, 25, 50])('keeps neighbors in a pie of %i slices far apart by alternating lighter and darker shades', count => {
		const levels = shadesOf('#ffffff', count).map(brightness);
		levels.forEach((level, index) => {
			// The last slice touches the first when there is no Other slice.
			expect(Math.abs(level - levels[(index + 1) % count])).toBeGreaterThan(0.25);
		});
	});

	it('falls back to the default pie base color when the base does not parse', () => {
		expect(buildSliceColor('not-a-color', 0)).toBe(CHART_COLORS.pie);
	});
});
