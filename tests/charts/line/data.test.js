import { describe, expect, it } from 'vitest';
import {
	AXIS_KIND,
	resolveXAxisKind,
	buildPoints,
	aggregatePoints,
	sortByX,
	formatXValue,
} from '../../../src/charts/line/data.js';

describe('resolveXAxisKind', () => {
	it('maps configured axis-type strings to the three kinds', () => {
		expect(resolveXAxisKind('date')).toBe(AXIS_KIND.date);
		expect(resolveXAxisKind('number')).toBe(AXIS_KIND.numeric);
		expect(resolveXAxisKind('numeric')).toBe(AXIS_KIND.numeric);
		expect(resolveXAxisKind('text')).toBe(AXIS_KIND.categorical);
		expect(resolveXAxisKind(undefined)).toBe(AXIS_KIND.categorical);
	});
});

describe('buildPoints', () => {
	it('parses numeric x, drops null/empty x, and keeps a missing y as NaN', () => {
		const rows = [{ x: 1, y: 10 }, { x: '', y: 5 }, { x: null, y: 5 }, { x: 3, y: null }];
		const points = buildPoints(rows, 'x', 'y', AXIS_KIND.numeric);
		expect(points.map(p => p.x)).toEqual([1, 3]);
		expect(Number.isNaN(points[1].y)).toBe(true);
	});

	it('parses date x and drops unparseable dates', () => {
		const rows = [{ x: '2024-01-01', y: 1 }, { x: 'not-a-date', y: 2 }];
		const points = buildPoints(rows, 'x', 'y', AXIS_KIND.date);
		expect(points).toHaveLength(1);
		expect(points[0].x).toBeInstanceOf(Date);
	});

	it('coerces categorical x to strings', () => {
		const rows = [{ x: 5, y: 1 }, { x: 'b', y: 2 }];
		const points = buildPoints(rows, 'x', 'y', AXIS_KIND.categorical);
		expect(points.map(p => p.x)).toEqual(['5', 'b']);
	});
});

describe('aggregatePoints', () => {
	const pts = [{ x: 1, y: 10 }, { x: 1, y: 20 }, { x: 2, y: 5 }];

	it('returns points unchanged in none mode', () => {
		expect(aggregatePoints(pts, 'none')).toBe(pts);
	});

	it('collapses each x group by count/sum/mean', () => {
		const byX = (mode) => aggregatePoints(pts, mode).map(p => [p.x, p.y]);
		expect(byX('count')).toEqual([[1, 2], [2, 1]]);
		expect(byX('sum')).toEqual([[1, 30], [2, 5]]);
		expect(byX('mean')).toEqual([[1, 15], [2, 5]]);
	});

	describe('a group whose y values are all missing', () => {
		// buildPoints keeps a missing y as NaN so the renderer can gap it, but
		// the group still exists because its x was valid.
		const withEmptyGroup = [{ x: 1, y: 10 }, { x: 2, y: NaN }];

		it('sums to NaN so the renderer gaps it instead of dipping to zero', () => {
			const summed = aggregatePoints(withEmptyGroup, 'sum');
			expect(summed.map(p => p.x)).toEqual([1, 2]);
			expect(summed[0].y).toBe(10);
			expect(summed[1].y).toBeNaN();
		});

		it('matches mean, which already gapped it', () => {
			const summed = aggregatePoints(withEmptyGroup, 'sum');
			const meaned = aggregatePoints(withEmptyGroup, 'mean');
			expect(Number.isNaN(summed[1].y)).toBe(Number.isNaN(meaned[1].y));
		});

		it('still counts zero present values, which is a truthful count', () => {
			expect(aggregatePoints(withEmptyGroup, 'count').map(p => [p.x, p.y]))
				.toEqual([[1, 1], [2, 0]]);
		});
	});
});

describe('buildPoints missing-value handling', () => {
	it.each([
		['empty string', ''],
		['whitespace', '   '],
		['null', null],
	])('keeps a %s y as NaN rather than zero', (_label, missing) => {
		const points = buildPoints([{ x: 1, y: missing }], 'x', 'y', AXIS_KIND.numeric);
		expect(points).toHaveLength(1);
		expect(points[0].y).toBeNaN();
	});

	it.each([
		['empty string', ''],
		['whitespace', '   '],
		['null', null],
	])('skips a row whose numeric x is %s', (_label, missing) => {
		expect(buildPoints([{ x: missing, y: 1 }], 'x', 'y', AXIS_KIND.numeric)).toEqual([]);
	});
});

describe('sortByX', () => {
	it('sorts numeric ascending without mutating the input', () => {
		const input = [{ x: 3 }, { x: 1 }, { x: 2 }];
		const sorted = sortByX(input, AXIS_KIND.numeric);
		expect(sorted.map(p => p.x)).toEqual([1, 2, 3]);
		expect(input.map(p => p.x)).toEqual([3, 1, 2]);
	});

	it('sorts dates by time and categories by string', () => {
		const dates = [{ x: new Date('2024-03-01') }, { x: new Date('2024-01-01') }];
		expect(sortByX(dates, AXIS_KIND.date).map(p => p.x.getTime()))
			.toEqual([new Date('2024-01-01').getTime(), new Date('2024-03-01').getTime()]);
		expect(sortByX([{ x: 'b' }, { x: 'a' }], AXIS_KIND.categorical).map(p => p.x)).toEqual(['a', 'b']);
	});
});

describe('formatXValue', () => {
	it('formats categorical x as a plain string and numeric/date as non-empty strings', () => {
		expect(formatXValue('cat', AXIS_KIND.categorical)).toBe('cat');
		expect(formatXValue(null, AXIS_KIND.categorical)).toBe('');
		const numeric = formatXValue(1234.5, AXIS_KIND.numeric, 'en-US');
		expect(typeof numeric).toBe('string');
		expect(numeric).toContain('234');
		expect(typeof formatXValue(new Date('2024-01-01'), AXIS_KIND.date, 'en-US')).toBe('string');
	});
});
