/**
 * 3D-scatter data preparation.
 *
 * Pure: rows plus three column names in, plottable points plus honest
 * counts out. No DOM, no state, no vendor imports.
 *
 * Sampling policy: when the valid points exceed the render budget
 * (`SCATTER3D_CHART.maxPoints`), the sample always keeps the rows that
 * carry each axis minimum and maximum (de-duped by row position, one row
 * can carry several extrema) and fills the remaining budget by
 * deterministic stride sampling across the whole valid set. Extents are
 * computed from ALL valid rows before sampling, so the coordinate system
 * never shifts because an outlier was sampled out.
 */

import { SCATTER3D_CHART } from '../../config/charts/definitions/scatter3d.js';
import { toFiniteNumber } from '../../utils/formatters.js';
import { sampleWithExtrema } from '../shared/pointSampling.js';

/**
 * Per-axis `[min, max]` extents.
 *
 * @typedef {Object} Scatter3dExtents
 * @property {[number, number]} x
 * @property {[number, number]} y
 * @property {[number, number]} z
 */

/**
 * Build the plottable point set for the 3D scatter.
 *
 * Values are coerced with `toFiniteNumber(...)` and then filtered with
 * `Number.isFinite(...)`, matching the other charts, so numeric strings
 * survive while null/undefined/blank/NaN rows drop out. Plain `Number()`
 * would turn a blank cell into a real point at `0`, which then anchors the
 * axis extent and squeezes every genuine point against the opposite face.
 *
 * @param {Array<Object<string, *>>} rows
 * @param {string} x - Numeric column for the X axis.
 * @param {string} y - Numeric column for the Y axis.
 * @param {string} z - Numeric column for the Z axis.
 * @returns {{
 *   points: Array<{ x: number, y: number, z: number, index: number }>,
 *   extents: Scatter3dExtents | null,
 *   renderedCount: number,
 *   validCount: number,
 *   totalCount: number,
 *   truncated: boolean,
 * }} `extents` is `null` when there are no valid points.
 */
export function buildScatter3dPoints(rows, x, y, z) {
	const totalCount = Array.isArray(rows) ? rows.length : 0;
	const valid = [];
	for (let index = 0; index < totalCount; index++) {
		const row = rows[index];
		const px = toFiniteNumber(row?.[x]);
		const py = toFiniteNumber(row?.[y]);
		const pz = toFiniteNumber(row?.[z]);
		if (Number.isFinite(px) && Number.isFinite(py) && Number.isFinite(pz)) {
			valid.push({ x: px, y: py, z: pz, index });
		}
	}

	const validCount = valid.length;
	if (validCount === 0) {
		return { points: [], extents: null, renderedCount: 0, validCount: 0, totalCount, truncated: false };
	}

	const extents = computeExtents(valid);

	if (validCount <= SCATTER3D_CHART.maxPoints) {
		return { points: valid, extents, renderedCount: validCount, validCount, totalCount, truncated: false };
	}

	const points = sampleWithExtrema(valid, SCATTER3D_CHART.maxPoints, [
		point => point.x,
		point => point.y,
		point => point.z,
	]);
	return { points, extents, renderedCount: points.length, validCount, totalCount, truncated: true };
}

/**
 * Per-axis extents over every valid point.
 *
 * @private
 * @param {Array<{ x: number, y: number, z: number }>} valid
 * @returns {Scatter3dExtents}
 */
function computeExtents(valid) {
	let minX = Infinity, maxX = -Infinity;
	let minY = Infinity, maxY = -Infinity;
	let minZ = Infinity, maxZ = -Infinity;
	for (const point of valid) {
		if (point.x < minX) minX = point.x;
		if (point.x > maxX) maxX = point.x;
		if (point.y < minY) minY = point.y;
		if (point.y > maxY) maxY = point.y;
		if (point.z < minZ) minZ = point.z;
		if (point.z > maxZ) maxZ = point.z;
	}
	return { x: [minX, maxX], y: [minY, maxY], z: [minZ, maxZ] };
}
