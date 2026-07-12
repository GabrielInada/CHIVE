/**
 * TIN color-scale construction.
 *
 * Turns a resolved ramp name plus the Z distribution into one cohesive scale:
 * a continuous `sampleRamp(t)`, a `tForZ(z)` that maps a Z value to its 0..1
 * ramp position (by value or by rank), and a `bucketAt(z)` that quantizes Z
 * into one of `bucketCount` color buckets. Building all three from a single
 * call keeps them from drifting apart. Used by `renderers/svg.js`.
 */

import {
	interpolateGreys,
	interpolateInferno,
	interpolateMagma,
	interpolatePlasma,
	interpolateRgbBasis,
	interpolateTurbo,
	interpolateViridis,
} from '../../../vendor/d3/d3.js';
import { TIN_CHART } from '../../config/charts.js';
import { interpolateColor } from '../../utils/colorUtils.js';

// d3 ships sequential interpolators for the common scientific ramps. Terrain
// isn't built in, so we synthesize one with interpolateRgbBasis through a
// canonical low-to-high-elevation gradient (deep water -> shore -> grass ->
// foothills -> mountain -> snow). Keys must match TIN_COLOR_RAMPS minus 'custom'.
// Module-private implementation data: exercised through createTinColorScale.
const D3_RAMP_BY_NAME = Object.freeze({
	viridis: interpolateViridis,
	plasma: interpolatePlasma,
	magma: interpolateMagma,
	inferno: interpolateInferno,
	turbo: interpolateTurbo,
	grays: interpolateGreys,
	terrain: interpolateRgbBasis([
		'#3b6797',
		'#5e9cba',
		'#92c0a8',
		'#c8d9a5',
		'#b1a877',
		'#8a6f4a',
		'#ffffff',
	]),
});

/**
 * Build the TIN color scale for a render.
 *
 * @param {Object} args
 * @param {string} args.colorRamp - Already-normalized ramp name (a key of the
 *   private ramp table, or 'custom' for the two-color gradient).
 * @param {string} args.gradientMin - Custom-gradient low color.
 * @param {string} args.gradientMax - Custom-gradient high color.
 * @param {string} args.gradientDistribution - 'rank' or 'value'.
 * @param {Array<number>} args.zValues - All point Z values (for the rank distribution).
 * @param {number} args.zMin
 * @param {number} args.zMax
 * @returns {{ sampleRamp: (t: number) => string, tForZ: (z: number) => number,
 *   bucketAt: (z: number) => number, bucketCount: number }}
 */
export function createTinColorScale({
	colorRamp,
	gradientMin,
	gradientMax,
	gradientDistribution,
	zValues,
	zMin,
	zMax,
}) {
	const rampInterp = colorRamp === 'custom' ? null : D3_RAMP_BY_NAME[colorRamp];
	const sampleRamp = rampInterp
		? t => rampInterp(Math.max(0, Math.min(1, t)))
		: t => interpolateColor(gradientMin, gradientMax, Math.max(0, Math.min(1, t)));

	// Maps a Z value to its 0..1 ramp position. Quantization into color buckets
	// happens in bucketAt; the legend still samples the continuous ramp.
	let tForZ;
	if (gradientDistribution === 'rank') {
		const sortedZ = [...zValues].sort((a, b) => a - b);
		tForZ = z => {
			let lo = 0;
			let hi = sortedZ.length;
			while (lo < hi) {
				const mid = (lo + hi) >>> 1;
				if (sortedZ[mid] < z) lo = mid + 1;
				else hi = mid;
			}
			return lo / Math.max(sortedZ.length - 1, 1);
		};
	} else {
		const zDelta = zMax - zMin || 1;
		tForZ = z => (z - zMin) / zDelta;
	}

	const bucketCount = TIN_CHART.rampBuckets;
	const bucketAt = z => Math.min(
		bucketCount - 1,
		Math.floor(Math.max(0, Math.min(1, tForZ(z))) * bucketCount),
	);

	return { sampleRamp, tForZ, bucketAt, bucketCount };
}
