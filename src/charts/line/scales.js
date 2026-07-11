/**
 * Line-chart x-scale construction.
 *
 * Builds the d3 x scale for the resolved x-axis kind: a UTC time scale for
 * dates, a linear scale for numbers (with a +/-1 pad when the domain is a
 * single point), and a padded point scale for categories. No DOM. Used by
 * `renderers/svg.js`.
 */

import { extent, scaleLinear, scalePoint, scaleUtc } from '../../../vendor/d3/d3.js';
import { AXIS_KIND } from './data.js';

/**
 * Build the x scale for the given x-axis kind over `points`.
 *
 * @param {'date'|'numeric'|'categorical'} xKind
 * @param {Array<{x: *}>} points
 * @param {[number, number]} range - Pixel range `[0, innerWidth]`.
 * @returns {Function} A d3 scale.
 */
export function buildXScale(xKind, points, range) {
	if (xKind === AXIS_KIND.date) {
		return scaleUtc().domain(extent(points, p => p.x)).range(range);
	}
	if (xKind === AXIS_KIND.numeric) {
		const [xMin, xMax] = extent(points, p => p.x);
		const domain = xMin === xMax
			? [xMin - 1, xMax + 1]
			: [xMin, xMax];
		return scaleLinear().domain(domain).range(range);
	}
	const domain = [];
	const seen = new Set();
	for (const point of points) {
		const value = point.x;
		if (seen.has(value)) continue;
		seen.add(value);
		domain.push(value);
	}
	return scalePoint().domain(domain).range(range).padding(0.5);
}
