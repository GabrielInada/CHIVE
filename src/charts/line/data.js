/**
 * Line-chart point preparation.
 *
 * Maps source rows into `{ x, y }` points by x-axis kind (numeric / date /
 * categorical), optionally aggregates repeated x values (none / count / sum /
 * mean), and sorts by x. Also formats an x value for tooltips/labels. Pure: no
 * DOM, no d3. The d3 x-scale construction lives in `scales.js`; the
 * missing-mode path drawing stays in `renderers/svg.js`. Used by
 * `renderers/svg.js`.
 */

import { formatDate, formatNumber, isNullish, toFiniteNumber } from '../../utils/formatters.js';
import { compareStrings } from '../../domain/filters/chartFilter.js';

export const AXIS_KIND = { date: 'date', numeric: 'numeric', categorical: 'categorical' };

/**
 * Resolve the configured axis-type string to one of the three x-axis kinds.
 *
 * @param {string} configuredAxisType
 * @returns {'date'|'numeric'|'categorical'}
 */
export function resolveXAxisKind(configuredAxisType) {
	const value = String(configuredAxisType || '').toLowerCase();
	if (value === 'date') return AXIS_KIND.date;
	if (value === 'number' || value === 'numeric') return AXIS_KIND.numeric;
	return AXIS_KIND.categorical;
}

/** @private */
function toDateOrNull(value) {
	if (isNullish(value) || value === '') return null;
	const date = value instanceof Date ? value : new Date(value);
	return Number.isFinite(date.getTime()) ? date : null;
}

/**
 * Build the `{ x, y, raw, index }` points from rows. Rows whose x is null/empty
 * (or an unparseable date/number for those kinds) are dropped; a missing y is
 * kept as `NaN` so the renderer can gap it.
 *
 * @param {Array<Object<string, *>>} rows
 * @param {string} xColumn
 * @param {string} yColumn
 * @param {'date'|'numeric'|'categorical'} xKind
 * @returns {Array<{x: *, y: number, raw: Object, index: number}>}
 */
export function buildPoints(rows, xColumn, yColumn, xKind) {
	const points = [];
	for (let index = 0; index < rows.length; index++) {
		const row = rows[index];
		const xRaw = row?.[xColumn];
		const yRaw = row?.[yColumn];
		const y = toFiniteNumber(yRaw);
		let x;
		if (xKind === AXIS_KIND.date) {
			x = toDateOrNull(xRaw);
		} else if (xKind === AXIS_KIND.numeric) {
			const n = toFiniteNumber(xRaw);
			x = Number.isFinite(n) ? n : null;
		} else {
			x = isNullish(xRaw) ? null : String(xRaw);
		}
		if (x === null || x === '') continue;
		points.push({ x, y, raw: row, index });
	}
	return points;
}

/**
 * Aggregate points that share an x value. `none` returns the points unchanged;
 * `count`/`sum`/`mean` collapse each x group to a single y; any other mode
 * takes the first y in the group.
 *
 * @param {Array<{x: *, y: number, raw: Object, index: number}>} points
 * @param {string} mode
 * @returns {Array<{x: *, y: number, raw: Object, index: number}>}
 */
export function aggregatePoints(points, mode) {
	if (mode === 'none') return points;
	const groups = new Map();
	for (const point of points) {
		const key = point.x instanceof Date ? point.x.getTime() : point.x;
		if (!groups.has(key)) groups.set(key, { x: point.x, ys: [], raw: point.raw, index: point.index });
		const group = groups.get(key);
		if (Number.isFinite(point.y)) group.ys.push(point.y);
	}
	const out = [];
	for (const group of groups.values()) {
		let y;
		if (mode === 'count') {
			y = group.ys.length;
		} else if (mode === 'sum') {
			// An empty group means every y in it was missing. Summing to 0 would
			// draw a real point at zero; NaN lets the renderer gap it instead,
			// matching mean below.
			y = group.ys.length ? group.ys.reduce((acc, v) => acc + v, 0) : NaN;
		} else if (mode === 'mean') {
			y = group.ys.length ? group.ys.reduce((acc, v) => acc + v, 0) / group.ys.length : NaN;
		} else {
			y = group.ys[0];
		}
		out.push({ x: group.x, y, raw: group.raw, index: group.index });
	}
	return out;
}

/**
 * Sort points by x for the given kind (date by time, numeric ascending,
 * categorical by string compare). Does not mutate the input.
 *
 * @param {Array<{x: *}>} points
 * @param {'date'|'numeric'|'categorical'} xKind
 * @returns {Array<{x: *}>}
 */
export function sortByX(points, xKind) {
	const cloned = points.slice();
	cloned.sort((a, b) => {
		if (xKind === AXIS_KIND.date) return a.x.getTime() - b.x.getTime();
		if (xKind === AXIS_KIND.numeric) return a.x - b.x;
		return compareStrings(a.x, b.x);
	});
	return cloned;
}

/**
 * Format an x value for tooltips/labels by kind.
 *
 * @param {*} value
 * @param {'date'|'numeric'|'categorical'} xKind
 * @param {string} [locale]
 * @returns {string}
 */
export function formatXValue(value, xKind, locale) {
	if (xKind === AXIS_KIND.date) return formatDate(value, locale);
	if (xKind === AXIS_KIND.numeric) return formatNumber(value, locale);
	return String(value ?? '');
}
