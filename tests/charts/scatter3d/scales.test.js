import { describe, expect, it } from 'vitest';
import { buildScatter3dScales } from '../../../src/charts/scatter3d/scales.js';

describe('buildScatter3dScales', () => {
	it('maps each axis onto the [-1, 1] unit cube', () => {
		const scales = buildScatter3dScales({ x: [0, 10], y: [-5, 5], z: [100, 200] });

		expect(scales.x(0)).toBe(-1);
		expect(scales.x(10)).toBe(1);
		expect(scales.x(5)).toBe(0);
		expect(scales.y(0)).toBe(0);
		expect(scales.z(150)).toBe(0);
	});

	it('exposes axis metadata with the raw extents', () => {
		const scales = buildScatter3dScales({ x: [0, 10], y: [-5, 5], z: [100, 200] });

		expect(scales.axes).toEqual([
			{ axis: 'x', min: 0, max: 10 },
			{ axis: 'y', min: -5, max: 5 },
			{ axis: 'z', min: 100, max: 200 },
		]);
	});

	it('pads a zero-span axis so positions stay finite (constant column)', () => {
		const scales = buildScatter3dScales({ x: [7, 7], y: [0, 1], z: [7, 7] });

		expect(Number.isFinite(scales.x(7))).toBe(true);
		expect(scales.x(7)).toBe(0);
		expect(Number.isFinite(scales.z(7))).toBe(true);
		// The reported metadata keeps the true (degenerate) extent.
		expect(scales.axes[0]).toEqual({ axis: 'x', min: 7, max: 7 });
	});

	it('never produces NaN for values inside the padded domain', () => {
		const scales = buildScatter3dScales({ x: [0, 0], y: [0, 0], z: [0, 0] });

		for (const axis of ['x', 'y', 'z']) {
			expect(Number.isNaN(scales[axis](0))).toBe(false);
		}
	});
});
