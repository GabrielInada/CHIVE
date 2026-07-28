import { describe, expect, it } from 'vitest';
import {
	getScatterPalette,
	resolveScatterColorScheme,
} from '../../../src/charts/scatter/palettes.js';
import {
	buildColorAccessor,
	buildRadiusAccessor,
} from '../../../src/charts/scatter/encoding.js';

function point(raw, index) {
	return { raw, index, isAggregate: false };
}

describe('palette helpers', () => {
	it('resolves known schemes and falls back to Bold', () => {
		expect(resolveScatterColorScheme('Pastel')).toBe('Pastel');
		expect(resolveScatterColorScheme('missing')).toBe('Bold');
		expect(resolveScatterColorScheme(undefined)).toBe('Bold');
	});

	it('returns a frozen palette array that cannot be mutated', () => {
		const palette = getScatterPalette('Bold');
		expect(Object.isFrozen(palette)).toBe(true);
		expect(() => palette.push('#000000')).toThrow();
		// A later call still returns the original, unmutated palette.
		expect(getScatterPalette('Bold')).toHaveLength(8);
	});
});

describe('buildRadiusAccessor', () => {
	it('returns the base radius for every point in uniform size mode', () => {
		const points = [point({ sz: 1 }, 0), point({ sz: 9 }, 1)];
		const getPointRadius = buildRadiusAccessor({
			points,
			sizeMode: 'uniform',
			sizeField: null,
			sizeMin: 2,
			sizeMax: 12,
			radius: 4,
			shouldAggregateCategoricalPairs: false,
		});
		expect(points.map(getPointRadius)).toEqual([4, 4]);
	});

	it('maps a numeric size field across [sizeMin, sizeMax]', () => {
		const points = [point({ sz: 1 }, 0), point({ sz: 5 }, 1), point({ sz: 10 }, 2)];
		const getPointRadius = buildRadiusAccessor({
			points,
			sizeMode: 'numeric',
			sizeField: 'sz',
			sizeMin: 2,
			sizeMax: 12,
			radius: 4,
			shouldAggregateCategoricalPairs: false,
		});
		const radii = points.map(getPointRadius);
		expect(Math.min(...radii)).toBeCloseTo(2);
		expect(Math.max(...radii)).toBeCloseTo(12);
		expect(new Set(radii).size).toBe(3);
	});

	it('keeps blank size values out of the domain and falls back to the base radius', () => {
		// A blank read as 0 would anchor the sqrt domain at 0 and shrink every
		// genuine point toward sizeMin.
		const points = [point({ sz: 10 }, 0), point({ sz: 20 }, 1), point({ sz: '' }, 2)];
		const getPointRadius = buildRadiusAccessor({
			points,
			sizeMode: 'numeric',
			sizeField: 'sz',
			sizeMin: 2,
			sizeMax: 12,
			radius: 4,
			shouldAggregateCategoricalPairs: false,
		});
		expect(getPointRadius(points[0])).toBeCloseTo(2);
		expect(getPointRadius(points[1])).toBeCloseTo(12);
		expect(getPointRadius(points[2])).toBe(4);
	});

	it('sizes aggregate bubbles by their count', () => {
		const points = [
			{ isAggregate: true, count: 1, index: 0 },
			{ isAggregate: true, count: 10, index: 1 },
		];
		const getPointRadius = buildRadiusAccessor({
			points,
			sizeMode: 'uniform',
			sizeField: null,
			sizeMin: 2,
			sizeMax: 12,
			radius: 4,
			shouldAggregateCategoricalPairs: true,
		});
		expect(getPointRadius(points[1])).toBeGreaterThan(getPointRadius(points[0]));
	});
});

describe('buildColorAccessor', () => {
	const baseArgs = {
		color: '#1a472a',
		gradientMinColor: '#000000',
		gradientMaxColor: '#ffffff',
		colorScheme: 'Bold',
		gradientDistribution: 'value',
	};

	it('returns the base color and no category map in uniform mode', () => {
		const points = [point({}, 0)];
		const result = buildColorAccessor({ ...baseArgs, points, colorMode: 'uniform', colorField: null });
		expect(result.getPointColor(points[0])).toBe('#1a472a');
		expect(result.categoryMap).toBeNull();
		expect(result.getCategoryColorValue).toBeNull();
	});

	it('interpolates a numeric gradient across its endpoints', () => {
		const points = [point({ val: 0 }, 0), point({ val: 5 }, 1), point({ val: 10 }, 2)];
		const result = buildColorAccessor({ ...baseArgs, points, colorMode: 'numeric', colorField: 'val' });
		const fills = new Set(points.map(result.getPointColor));
		expect(fills.has('#000000')).toBe(true);
		expect(fills.has('#FFFFFF')).toBe(true);
	});

	it('excludes blank values from the gradient domain on ordinary points', () => {
		// Read as 0, a blank would stretch the domain down to zero and shift
		// every real point's position along the gradient.
		const points = [point({ val: 10 }, 0), point({ val: 20 }, 1), point({ val: '' }, 2)];
		const result = buildColorAccessor({ ...baseArgs, points, colorMode: 'numeric', colorField: 'val' });

		expect(result.getPointColor(points[0])).toBe('#000000');
		expect(result.getPointColor(points[1])).toBe('#FFFFFF');
		// Not on the gradient at all, so it falls back to the base color.
		expect(result.getPointColor(points[2])).toBe('#1a472a');
	});

	it('averages only the present values of an aggregate point', () => {
		const aggregate = {
			isAggregate: true,
			index: 0,
			rawRows: [{ val: 10 }, { val: 20 }, { val: '' }, { val: null }],
		};
		const plain = point({ val: 15 }, 1);
		const result = buildColorAccessor({
			...baseArgs,
			points: [aggregate, plain],
			colorMode: 'numeric',
			colorField: 'val',
		});

		// Mean of the two present values is 15, identical to the plain point,
		// so both land on the same gradient stop. Counting the blanks would
		// average 30/4 = 7.5 and pull the aggregate toward the min color.
		expect(result.getPointColor(aggregate)).toBe(result.getPointColor(plain));
	});

	it('produces different fills for rank vs value distribution on skewed data', () => {
		const points = [point({ val: 1 }, 0), point({ val: 1 }, 1), point({ val: 1 }, 2), point({ val: 100 }, 3)];
		const value = buildColorAccessor({ ...baseArgs, points, colorMode: 'numeric', colorField: 'val', gradientDistribution: 'value' });
		const rank = buildColorAccessor({ ...baseArgs, points, colorMode: 'numeric', colorField: 'val', gradientDistribution: 'rank' });
		expect(points.map(value.getPointColor).join('|')).not.toBe(points.map(rank.getPointColor).join('|'));
	});

	it('assigns palette hues per category and exposes the category map', () => {
		const points = [point({ grp: 'a' }, 0), point({ grp: 'b' }, 1), point({ grp: 'a' }, 2)];
		const result = buildColorAccessor({ ...baseArgs, points, colorMode: 'category', colorField: 'grp' });
		expect(new Set(points.map(result.getPointColor))).toEqual(new Set(['#FF6B6B', '#4ECDC4']));
		expect(result.categoryMap.get('a')).toBe('#FF6B6B');
		expect(typeof result.getCategoryColorValue).toBe('function');
		expect(result.getCategoryColorValue(points[0])).toBe('a');
	});

	it('falls back to the base color when the numeric color field is missing', () => {
		const points = [point({}, 0), point({}, 1)];
		const result = buildColorAccessor({ ...baseArgs, points, colorMode: 'numeric', colorField: 'missing' });
		expect(new Set(points.map(result.getPointColor))).toEqual(new Set(['#1a472a']));
	});
});
