import { describe, expect, it } from 'vitest';
import {
	AXIS_TYPE_VALUES,
	isNumericLikeAxisType,
	isCategoricalLikeAxisType,
	inferAxisType,
	deterministicJitter,
	buildCategoryDomain,
	buildCategoryJitterScale,
	truncateCategoryTick,
	estimateLongestCategoryLength,
	computeAdaptiveMargins,
	aggregateCategoricalPairs,
	pickMostFrequentCategory,
	normalizeDomain,
} from '../../../src/charts/scatter/axisHelpers.js';

describe('isNumericLikeAxisType', () => {
	it('accepts "numeric" and "number" (case-insensitive)', () => {
		expect(isNumericLikeAxisType('numeric')).toBe(true);
		expect(isNumericLikeAxisType('NUMBER')).toBe(true);
		expect(isNumericLikeAxisType('Number')).toBe(true);
	});

	it('rejects other strings and falsy values', () => {
		expect(isNumericLikeAxisType('text')).toBe(false);
		expect(isNumericLikeAxisType('')).toBe(false);
		expect(isNumericLikeAxisType(null)).toBe(false);
		expect(isNumericLikeAxisType(undefined)).toBe(false);
	});
});

describe('isCategoricalLikeAxisType', () => {
	it('accepts categorical/text/date synonyms (case-insensitive)', () => {
		expect(isCategoricalLikeAxisType('categorical')).toBe(true);
		expect(isCategoricalLikeAxisType('CATEGORY')).toBe(true);
		expect(isCategoricalLikeAxisType('text')).toBe(true);
		expect(isCategoricalLikeAxisType('TEXT')).toBe(true);
		expect(isCategoricalLikeAxisType('date')).toBe(true);
		expect(isCategoricalLikeAxisType('DATE')).toBe(true);
	});

	it('rejects numeric synonyms and unknown strings', () => {
		expect(isCategoricalLikeAxisType('numeric')).toBe(false);
		expect(isCategoricalLikeAxisType('unknown')).toBe(false);
	});
});

describe('inferAxisType', () => {
	it('respects configured numeric type even with categorical-looking data', () => {
		expect(inferAxisType(['a', 'b', 'c'], 'numeric')).toBe(AXIS_TYPE_VALUES.numeric);
	});

	it('respects configured categorical type even with numeric-looking data', () => {
		expect(inferAxisType([1, 2, 3], 'categorical')).toBe(AXIS_TYPE_VALUES.categorical);
	});

	it('infers numeric when ≥80% of values are finite numbers', () => {
		expect(inferAxisType([1, 2, 3, 4, 'x'], null)).toBe(AXIS_TYPE_VALUES.numeric);
	});

	it('infers categorical when <80% of values are finite numbers', () => {
		expect(inferAxisType([1, 'a', 'b', 'c', 'd'], null)).toBe(AXIS_TYPE_VALUES.categorical);
	});

	it('falls back to categorical when no values are valid', () => {
		expect(inferAxisType([null, undefined, ''], null)).toBe(AXIS_TYPE_VALUES.categorical);
	});
});

describe('deterministicJitter', () => {
	it('produces the same offset for the same (index, seed)', () => {
		expect(deterministicJitter(5, 1.7)).toBe(deterministicJitter(5, 1.7));
	});

	it('produces different offsets for different seeds', () => {
		expect(deterministicJitter(5, 1.7)).not.toBe(deterministicJitter(5, 2.3));
	});

	it('returns values in the [-1, 1] range', () => {
		for (let i = 0; i < 50; i++) {
			const v = deterministicJitter(i, 1.7);
			expect(v).toBeGreaterThanOrEqual(-1);
			expect(v).toBeLessThanOrEqual(1);
		}
	});
});

describe('buildCategoryDomain', () => {
	it('deduplicates values preserving first-seen order', () => {
		const points = [{ x: 'A' }, { x: 'B' }, { x: 'A' }, { x: 'C' }, { x: 'B' }];
		expect(buildCategoryDomain(points, 'x')).toEqual(['A', 'B', 'C']);
	});

	it('returns empty array for empty input', () => {
		expect(buildCategoryDomain([], 'x')).toEqual([]);
	});
});

describe('buildCategoryJitterScale', () => {
	it('returns a callable that produces 0 when the scale has no step', () => {
		const jitter = buildCategoryJitterScale({ step: () => 0 });
		expect(Math.abs(jitter(5, 1.7))).toBe(0);
	});

	it('caps jitter at maxJitterCap (default 16)', () => {
		const jitter = buildCategoryJitterScale({ step: () => 1000 });
		for (let i = 0; i < 20; i++) {
			expect(Math.abs(jitter(i, 1.7))).toBeLessThanOrEqual(16);
		}
	});

	it('respects custom maxJitterCap', () => {
		const jitter = buildCategoryJitterScale({ step: () => 1000 }, 4);
		for (let i = 0; i < 20; i++) {
			expect(Math.abs(jitter(i, 1.7))).toBeLessThanOrEqual(4);
		}
	});
});

describe('truncateCategoryTick', () => {
	it('passes through strings at or below the length cap', () => {
		expect(truncateCategoryTick('short', 20)).toBe('short');
	});

	it('truncates with an ellipsis when longer than the cap', () => {
		expect(truncateCategoryTick('abcdefghij', 5)).toBe('abcd…');
	});

	it('coerces non-strings via String()', () => {
		expect(truncateCategoryTick(12345, 3)).toBe('12…');
	});
});

describe('estimateLongestCategoryLength', () => {
	it('returns the max length seen across the keyed field', () => {
		const points = [{ x: 'A' }, { x: 'Hello' }, { x: 'Hi' }];
		expect(estimateLongestCategoryLength(points, 'x')).toBe(5);
	});

	it('treats missing/null values as length 0', () => {
		const points = [{ x: null }, { x: undefined }, { x: 'ab' }];
		expect(estimateLongestCategoryLength(points, 'x')).toBe(2);
	});
});

describe('computeAdaptiveMargins', () => {
	const baseMargins = { top: 20, right: 20, bottom: 30, left: 40 };

	it('expands the left margin when y axis is categorical', () => {
		const margins = computeAdaptiveMargins(
			baseMargins,
			[{ yCategory: 'a-fairly-long-category-name' }],
			{ x: AXIS_TYPE_VALUES.numeric, y: AXIS_TYPE_VALUES.categorical },
		);
		expect(margins.left).toBeGreaterThan(baseMargins.left);
		expect(margins.bottom).toBe(baseMargins.bottom);
	});

	it('expands the bottom margin when x axis is categorical', () => {
		const margins = computeAdaptiveMargins(
			baseMargins,
			[{ xCategory: 'category-with-a-decent-length' }],
			{ x: AXIS_TYPE_VALUES.categorical, y: AXIS_TYPE_VALUES.numeric },
		);
		expect(margins.bottom).toBeGreaterThan(baseMargins.bottom);
		expect(margins.left).toBe(baseMargins.left);
	});

	it('returns the base margins when both axes are numeric', () => {
		expect(computeAdaptiveMargins(
			baseMargins,
			[{ xCategory: 'x', yCategory: 'y' }],
			{ x: AXIS_TYPE_VALUES.numeric, y: AXIS_TYPE_VALUES.numeric },
		)).toEqual(baseMargins);
	});
});

describe('aggregateCategoricalPairs', () => {
	it('groups duplicate (xCategory, yCategory) pairs into one row with count', () => {
		const points = [
			{ xCategory: 'A', yCategory: 'X', index: 0, raw: { id: 1 } },
			{ xCategory: 'A', yCategory: 'X', index: 1, raw: { id: 2 } },
			{ xCategory: 'B', yCategory: 'Y', index: 2, raw: { id: 3 } },
		];
		const result = aggregateCategoricalPairs(points);
		expect(result).toHaveLength(2);
		const ax = result.find(r => r.xCategory === 'A' && r.yCategory === 'X');
		expect(ax.count).toBe(2);
		expect(ax.isAggregate).toBe(true);
		expect(ax.rawRows).toEqual([{ id: 1 }, { id: 2 }]);
	});

	it('keeps the lowest index and its raw row as the representative', () => {
		const points = [
			{ xCategory: 'A', yCategory: 'X', index: 5, raw: { id: 'late' } },
			{ xCategory: 'A', yCategory: 'X', index: 1, raw: { id: 'early' } },
		];
		const [group] = aggregateCategoricalPairs(points);
		expect(group.index).toBe(1);
		expect(group.raw).toEqual({ id: 'early' });
	});

	it('returns an empty array for empty input', () => {
		expect(aggregateCategoricalPairs([])).toEqual([]);
	});
});

describe('pickMostFrequentCategory', () => {
	it('returns the most frequent value in the field', () => {
		const rows = [{ k: 'A' }, { k: 'B' }, { k: 'A' }, { k: 'C' }, { k: 'A' }];
		expect(pickMostFrequentCategory(rows, 'k')).toBe('A');
	});

	it('breaks ties by lexicographic order (lower wins)', () => {
		const rows = [{ k: 'B' }, { k: 'A' }];
		expect(pickMostFrequentCategory(rows, 'k')).toBe('A');
	});

	it('returns N/A for an empty input', () => {
		expect(pickMostFrequentCategory([], 'k')).toBe('N/A');
	});
});

describe('normalizeDomain', () => {
	it('passes through a valid non-zero-width range', () => {
		expect(normalizeDomain([1, 10])).toEqual([1, 10]);
	});

	it('widens a zero-width non-zero range by 10%', () => {
		const [min, max] = normalizeDomain([5, 5]);
		expect(min).toBeCloseTo(4.5);
		expect(max).toBeCloseTo(5.5);
	});

	it('widens a zero-zero range by ±1', () => {
		expect(normalizeDomain([0, 0])).toEqual([-1, 1]);
	});

	it('returns [0, 1] for non-finite inputs', () => {
		expect(normalizeDomain([NaN, 10])).toEqual([0, 1]);
		expect(normalizeDomain([Infinity, -Infinity])).toEqual([0, 1]);
	});
});
