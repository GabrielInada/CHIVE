import { describe, expect, it } from 'vitest';
import { buildScatter3dPoints } from '../../../src/charts/scatter3d/data.js';
import { SCATTER3D_CHART } from '../../../src/config/charts/definitions/scatter3d.js';

function rowsFrom(triples) {
	return triples.map(([x, y, z]) => ({ x, y, z }));
}

describe('buildScatter3dPoints', () => {
	it('coerces then filters: numeric strings survive, non-finite rows drop', () => {
		const rows = [
			{ x: '1', y: '2', z: '3' },
			{ x: 4, y: 5, z: 6 },
			{ x: 'seven', y: 8, z: 9 },
			{ y: 1, z: 2 },
			{ x: 1, y: 2, z: Infinity },
		];

		const result = buildScatter3dPoints(rows, 'x', 'y', 'z');

		expect(result.totalCount).toBe(5);
		expect(result.validCount).toBe(2);
		expect(result.renderedCount).toBe(2);
		expect(result.truncated).toBe(false);
		expect(result.points[0]).toEqual({ x: 1, y: 2, z: 3, index: 0 });
		expect(result.points[1]).toEqual({ x: 4, y: 5, z: 6, index: 1 });
	});

	it.each([
		['null', null],
		['empty string', ''],
		['whitespace', '   '],
		['undefined', undefined],
	])('drops rows whose coordinate is %s rather than plotting it at zero', (_label, missing) => {
		const result = buildScatter3dPoints([{ x: missing, y: 1, z: 2 }], 'x', 'y', 'z');

		expect(result.validCount).toBe(0);
		expect(result.points).toEqual([]);
		expect(result.extents).toBeNull();
	});

	it('keeps blank rows out of the extents so real values are not squeezed against one face', () => {
		// Survey coordinates: a large constant offset with a small spread. A
		// phantom zero from a blank row anchors the domain at 0 and collapses
		// every genuine point onto the opposite cube face.
		const rows = [
			{ x: 784431.551, y: 9839149.107, z: 6.358 },
			{ x: 784411.896, y: 9839159.365, z: 7.045 },
			{ x: 784496.014, y: 9839134.221, z: 6.077 },
			{ x: '', y: '', z: '' },
		];

		const { extents, validCount, totalCount } = buildScatter3dPoints(rows, 'x', 'y', 'z');

		expect(totalCount).toBe(4);
		expect(validCount).toBe(3);
		expect(extents.x).toEqual([784411.896, 784496.014]);
		expect(extents.y).toEqual([9839134.221, 9839159.365]);
		expect(extents.z).toEqual([6.077, 7.045]);
	});

	it('returns null extents and empty points when nothing is valid', () => {
		const result = buildScatter3dPoints([{ x: 'a', y: 'b', z: 'c' }], 'x', 'y', 'z');

		expect(result).toEqual({
			points: [],
			extents: null,
			renderedCount: 0,
			validCount: 0,
			totalCount: 1,
			truncated: false,
		});
	});

	it('computes per-axis extents over every valid row', () => {
		const rows = rowsFrom([[3, -1, 10], [-5, 7, 2], [0, 0, 99]]);

		const { extents } = buildScatter3dPoints(rows, 'x', 'y', 'z');

		expect(extents).toEqual({ x: [-5, 3], y: [-1, 7], z: [2, 99] });
	});

	it('does not sample at or below the cap', () => {
		const rows = rowsFrom(Array.from({ length: 100 }, (_, i) => [i, i, i]));

		const result = buildScatter3dPoints(rows, 'x', 'y', 'z');

		expect(result.truncated).toBe(false);
		expect(result.renderedCount).toBe(100);
	});

	describe('sampling above the cap', () => {
		const count = SCATTER3D_CHART.maxPoints + 10000;
		const rows = rowsFrom(Array.from({ length: count }, (_, i) => [i, count - i, (i * 7) % count]));
		const result = buildScatter3dPoints(rows, 'x', 'y', 'z');

		it('respects the cap and reports honest counts', () => {
			expect(result.truncated).toBe(true);
			expect(result.renderedCount).toBeLessThanOrEqual(SCATTER3D_CHART.maxPoints);
			// Stride picks colliding with extrema picks can shave a handful off.
			expect(result.renderedCount).toBeGreaterThan(SCATTER3D_CHART.maxPoints - 10);
			expect(result.validCount).toBe(count);
			expect(result.totalCount).toBe(count);
			expect(result.points).toHaveLength(result.renderedCount);
		});

		it('computes extents from ALL valid rows, not the sample', () => {
			// z = (i * 7) % count with gcd(7, count) = 1 hits every residue,
			// so its true extent spans the full range.
			expect(result.extents).toEqual({
				x: [0, count - 1],
				y: [1, count],
				z: [0, count - 1],
			});
		});

		it('force-includes the rows carrying each axis min and max', () => {
			for (const axis of ['x', 'y', 'z']) {
				const [min, max] = result.extents[axis];
				expect(result.points.some(point => point[axis] === min)).toBe(true);
				expect(result.points.some(point => point[axis] === max)).toBe(true);
			}
		});

		it('spreads across the whole dataset with no first-rows bias', () => {
			const indexes = result.points.map(point => point.index);
			expect(Math.max(...indexes)).toBeGreaterThan(count * 0.95);
			// Roughly a fifth of the sample should sit in each fifth of the data.
			const lastFifth = indexes.filter(index => index >= count * 0.8).length;
			expect(lastFifth).toBeGreaterThan(result.renderedCount * 0.15);
		});

		it('emits unique source rows only (no duplicates)', () => {
			const indexes = result.points.map(point => point.index);
			expect(new Set(indexes).size).toBe(indexes.length);
		});
	});

	it('de-dupes a single row carrying several extrema', () => {
		// Row 0 is the minimum of all three axes at once; the sample must
		// contain it exactly once and still fill the budget from the rest.
		const count = SCATTER3D_CHART.maxPoints + 500;
		const rows = rowsFrom(Array.from({ length: count }, (_, i) => [i, i, i]));

		const result = buildScatter3dPoints(rows, 'x', 'y', 'z');

		expect(result.truncated).toBe(true);
		const zeros = result.points.filter(point => point.index === 0);
		expect(zeros).toHaveLength(1);
		const lasts = result.points.filter(point => point.index === count - 1);
		expect(lasts).toHaveLength(1);
		const indexes = result.points.map(point => point.index);
		expect(new Set(indexes).size).toBe(indexes.length);
	});
});
