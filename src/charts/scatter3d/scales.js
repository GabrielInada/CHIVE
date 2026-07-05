/**
 * 3D-scatter scales: the "D3 math -> Three renderer" contract.
 *
 * Pure: full-set extents in, one linear scale per axis mapping data space
 * onto the renderer's [-1, 1] unit cube, plus axis metadata for labels.
 * Built from the extents of ALL valid points (not the sampled subset), so
 * the cube always frames the real data range.
 */

import { scaleLinear } from '../../../vendor/d3/d3.js';

/**
 * Build the per-axis scales for the unit cube.
 *
 * Zero-span extents (a constant column) are padded by one unit on each
 * side so the scale stays invertible and positions stay finite instead
 * of collapsing to NaN.
 *
 * @param {import('./data.js').Scatter3dExtents} extents
 * @returns {{
 *   x: (value: number) => number,
 *   y: (value: number) => number,
 *   z: (value: number) => number,
 *   axes: Array<{ axis: 'x' | 'y' | 'z', min: number, max: number }>,
 * }}
 */
export function buildScatter3dScales(extents) {
	const domains = {
		x: padDegenerate(extents.x),
		y: padDegenerate(extents.y),
		z: padDegenerate(extents.z),
	};

	return {
		x: scaleLinear().domain(domains.x).range([-1, 1]),
		y: scaleLinear().domain(domains.y).range([-1, 1]),
		z: scaleLinear().domain(domains.z).range([-1, 1]),
		axes: [
			{ axis: 'x', min: extents.x[0], max: extents.x[1] },
			{ axis: 'y', min: extents.y[0], max: extents.y[1] },
			{ axis: 'z', min: extents.z[0], max: extents.z[1] },
		],
	};
}

/**
 * Pad a `[min, max]` pair whose span is zero so the domain keeps a
 * nonzero width.
 *
 * @private
 * @param {[number, number]} pair
 * @returns {[number, number]}
 */
function padDegenerate([min, max]) {
	if (min === max) {
		return [min - 1, max + 1];
	}
	return [min, max];
}
