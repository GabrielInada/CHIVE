import { describe, expect, it } from 'vitest';
import { createBarColorAccessor } from '../../../src/charts/bar/color.js';
import { interpolateColor } from '../../../src/utils/colorUtils.js';

const base = {
	color: '#123456',
	gradientMinColor: '#000000',
	gradientMaxColor: '#ffffff',
	gradientDistribution: 'value',
	manualThresholdPct: 50,
};

describe('createBarColorAccessor', () => {
	it('returns the uniform color for every entry in uniform mode', () => {
		const entries = [['A', 1], ['B', 99]];
		const accessor = createBarColorAccessor({ ...base, entries, colorMode: 'uniform' });
		expect(accessor(entries[0])).toBe('#123456');
		expect(accessor(entries[1])).toBe('#123456');
	});

	it('interpolates by value in gradient/value mode (min at lowest, max at highest)', () => {
		const entries = [['A', 0], ['B', 10]];
		const accessor = createBarColorAccessor({ ...base, entries, colorMode: 'gradient' });
		expect(accessor(entries[0])).toBe(interpolateColor('#000000', '#ffffff', 0));
		expect(accessor(entries[1])).toBe(interpolateColor('#000000', '#ffffff', 1));
	});

	it('spaces colors evenly by rank in gradient/rank mode, ignoring value magnitude', () => {
		const entries = [['A', 0], ['B', 1], ['C', 100]];
		const accessor = createBarColorAccessor({
			...base,
			entries,
			colorMode: 'gradient',
			gradientDistribution: 'rank',
		});
		// ranks 0/1/2 over denom 2 => 0, 0.5, 1 (independent of the 1 vs 100 gap).
		expect(accessor(entries[0])).toBe(interpolateColor('#000000', '#ffffff', 0));
		expect(accessor(entries[1])).toBe(interpolateColor('#000000', '#ffffff', 0.5));
		expect(accessor(entries[2])).toBe(interpolateColor('#000000', '#ffffff', 1));
	});

	it('splits at the percentile threshold in gradient-manual mode', () => {
		const entries = [['A', 0], ['B', 5], ['C', 10]];
		const accessor = createBarColorAccessor({ ...base, entries, colorMode: 'gradient-manual', manualThresholdPct: 50 });
		// threshold = 0 + (10 * 0.5) = 5; <= 5 -> min, > 5 -> max.
		expect(accessor(entries[0])).toBe('#000000');
		expect(accessor(entries[1])).toBe('#000000');
		expect(accessor(entries[2])).toBe('#ffffff');
	});
});
