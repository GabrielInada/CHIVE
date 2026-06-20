import { describe, expect, it } from 'vitest';
import {
	appendSubdividedFragments,
	clampDepth,
	collectUniqueEdges,
	computeIsolineSegments,
	fmtCoord,
	midpoint,
	resolveSurfaceDepth,
} from '../../../../src/modules/visualizations/tinChart/geometry.js';
import { TIN_CHART } from '../../../../src/config/charts.js';

describe('midpoint', () => {
	it('averages each coordinate', () => {
		expect(midpoint({ x: 0, y: 0, z: 0 }, { x: 10, y: 4, z: 8 })).toEqual({ x: 5, y: 2, z: 4 });
	});
});

describe('fmtCoord', () => {
	it('rounds to 2 decimal places', () => {
		expect(fmtCoord(1.23456)).toBe('1.23');
		expect(fmtCoord(1.235)).toBe('1.24');
		expect(fmtCoord(10)).toBe('10');
	});
});

describe('clampDepth', () => {
	it('rounds and clamps to the configured bounds', () => {
		expect(clampDepth(99)).toBe(TIN_CHART.maxSubdivisionDepth);
		expect(clampDepth(-5)).toBe(TIN_CHART.minSubdivisionDepth);
	});

	it('falls back to the default depth for non-finite input', () => {
		expect(clampDepth(undefined)).toBe(TIN_CHART.defaultSubdivisionDepth);
		expect(clampDepth('nope')).toBe(TIN_CHART.defaultSubdivisionDepth);
	});
});

describe('resolveSurfaceDepth', () => {
	const base = { fillMode: 'smooth', zMin: 0, zMax: 10, triangleCount: 10 };

	it('clamps the requested depth to the configured bounds', () => {
		expect(resolveSurfaceDepth({ ...base, requestedDepth: 99 })).toBe(TIN_CHART.maxSubdivisionDepth);
		expect(resolveSurfaceDepth({ ...base, requestedDepth: -5 })).toBe(TIN_CHART.minSubdivisionDepth);
	});

	it('forces depth 0 in flat fill mode', () => {
		expect(resolveSurfaceDepth({ ...base, fillMode: 'flat', requestedDepth: 4 })).toBe(0);
	});

	it('forces depth 0 when Z is constant', () => {
		expect(resolveSurfaceDepth({ ...base, zMin: 5, zMax: 5, requestedDepth: 4 })).toBe(0);
	});

	it('steps depth down to fit the leaf budget', () => {
		// 1100 * 4^4 = 281600 exceeds the budget; 1100 * 4^3 = 70400 fits.
		expect(resolveSurfaceDepth({ ...base, triangleCount: 1100, requestedDepth: 4 })).toBe(3);
	});

	it('floors at 0 when the base triangulation alone exceeds the budget', () => {
		expect(resolveSurfaceDepth({ ...base, triangleCount: 300000, requestedDepth: 4 })).toBe(0);
	});
});

describe('appendSubdividedFragments', () => {
	const tri = [
		{ x: 0, y: 0, z: 0 },
		{ x: 12, y: 0, z: 0 },
		{ x: 6, y: 12, z: 6 },
	];

	it('emits one M..Z fragment at depth 0, filed into the bucketAt index', () => {
		const buckets = [[], [], []];
		appendSubdividedFragments(tri, 0, () => 2, buckets);
		expect(buckets[0]).toHaveLength(0);
		expect(buckets[1]).toHaveLength(0);
		expect(buckets[2]).toHaveLength(1);
		expect(buckets[2][0]).toMatch(/^M.*Z$/);
	});

	it('emits 4**depth leaf fragments', () => {
		const buckets = [[]];
		appendSubdividedFragments(tri, 3, () => 0, buckets);
		expect(buckets[0]).toHaveLength(4 ** 3);
	});

	it('files leaves into buckets by their mean Z', () => {
		const buckets = [[], []];
		// bucketAt sends low-Z leaves to 0 and high-Z leaves to 1.
		appendSubdividedFragments(tri, 2, meanZ => (meanZ > 3 ? 1 : 0), buckets);
		expect(buckets[0].length + buckets[1].length).toBe(4 ** 2);
		expect(buckets[0].length).toBeGreaterThan(0);
		expect(buckets[1].length).toBeGreaterThan(0);
	});
});

describe('computeIsolineSegments', () => {
	const tri = [
		{ sx: 0, sy: 0, z: 0 },
		{ sx: 10, sy: 0, z: 0 },
		{ sx: 5, sy: 10, z: 10 },
	];

	it('returns one segment for a triangle straddling the level', () => {
		const { segments, longest } = computeIsolineSegments([tri], 5);
		expect(segments).toHaveLength(1);
		// Both crossings sit at the iso-level midpoints, so the cut is horizontal.
		expect(Math.abs(segments[0].y1 - segments[0].y2)).toBeLessThan(1e-9);
		expect(longest).not.toBeNull();
	});

	it('returns no segments when the level is outside the triangle Z range', () => {
		expect(computeIsolineSegments([tri], 20).segments).toHaveLength(0);
		expect(computeIsolineSegments([tri], 20).longest).toBeNull();
	});
});

describe('collectUniqueEdges', () => {
	it('dedupes the shared edge between two triangles', () => {
		// Triangles (0,1,2) and (1,2,3) share edge 1-2.
		const pairs = collectUniqueEdges([0, 1, 2, 1, 2, 3]);
		expect(pairs).toHaveLength(5);
		const normalized = pairs.map(([p, q]) => (p < q ? `${p}:${q}` : `${q}:${p}`));
		expect(new Set(normalized).size).toBe(5);
		expect(normalized.filter(e => e === '1:2')).toHaveLength(1);
	});
});
