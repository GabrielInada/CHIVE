/**
 * Scatter-plot axis helpers.
 *
 * Pure utilities for axis-type inference, categorical jitter, adaptive
 * margin calculation, and category aggregation. Used by `scatterPlot.js`
 * (rendering) and the regression module; also covered by unit tests.
 */

import { compareStrings, normalizeCategoryValue } from '../../utils/chartFilters.js';

/**
 * Two-value enumeration of scatter-plot axis types: `'numeric'` or
 * `'categorical'`. Date columns currently fall into `'categorical'`.
 */
export const AXIS_TYPE_VALUES = {
	numeric: 'numeric',
	categorical: 'categorical',
};

/**
 * True when `axisType` names a numeric-style value (`'numeric'`,
 * `'number'`, `'numero'`). Case-insensitive.
 *
 * @param {string} axisType
 * @returns {boolean}
 */
export function isNumericLikeAxisType(axisType) {
	const value = String(axisType || '').toLowerCase();
	return value === 'numeric' || value === 'number' || value === 'numero';
}

/**
 * True when `axisType` names a categorical-style value (`'categorical'`,
 * `'category'`, `'text'`, `'texto'`, `'date'`, `'data'`). Case-insensitive.
 *
 * @param {string} axisType
 * @returns {boolean}
 */
export function isCategoricalLikeAxisType(axisType) {
	const value = String(axisType || '').toLowerCase();
	return value === 'categorical' || value === 'category' || value === 'text' || value === 'texto' || value === 'date' || value === 'data';
}

/**
 * Decide the axis type. An explicit `configuredAxisType` wins; otherwise
 * uses an 80% numeric-conversion threshold (matches the column-type
 * detection heuristic in `dataService.js`).
 *
 * @param {Array<*>} axisValues
 * @param {string} [configuredAxisType] - Optional override; trusted when present.
 * @returns {'numeric' | 'categorical'}
 */
export function inferAxisType(axisValues, configuredAxisType) {
	if (isNumericLikeAxisType(configuredAxisType)) return AXIS_TYPE_VALUES.numeric;
	if (isCategoricalLikeAxisType(configuredAxisType)) return AXIS_TYPE_VALUES.categorical;

	const validValues = axisValues
		.filter(value => value !== null && value !== undefined && String(value).trim() !== '');
	if (validValues.length === 0) return AXIS_TYPE_VALUES.categorical;

	const numericCount = validValues
		.filter(value => Number.isFinite(Number(value)))
		.length;

	return (numericCount / validValues.length) >= 0.8
		? AXIS_TYPE_VALUES.numeric
		: AXIS_TYPE_VALUES.categorical;
}

/**
 * Deterministic pseudo-random jitter in `[-1, 1]`, seeded by `index` and
 * `axisSeed`. Uses the standard `sin(x) * 43758.5...` hash so the same
 * `(index, axisSeed)` always produces the same offset — important so the
 * categorical scatter does not visually "shuffle" between renders.
 *
 * @param {number} index
 * @param {number} axisSeed - Different per axis; pass distinct values for X vs Y.
 * @returns {number}
 */
export function deterministicJitter(index, axisSeed) {
	const raw = Math.sin((index + 1) * 12.9898 * axisSeed) * 43758.5453123;
	const fraction = raw - Math.floor(raw);
	return (fraction * 2) - 1;
}

/**
 * Build a categorical-domain array (unique values in encounter order).
 *
 * @param {Array<Object<string, *>>} pontos
 * @param {string} key
 * @returns {Array<*>}
 */
export function buildCategoryDomain(pontos, key) {
	const seen = new Set();
	const domain = [];
	pontos.forEach(ponto => {
		const value = ponto[key];
		if (seen.has(value)) return;
		seen.add(value);
		domain.push(value);
	});
	return domain;
}

/**
 * Build a `(index, axisSeed) => offsetPx` jitter function whose amplitude
 * is sized to a band scale's step (24% of step, capped at `maxJitterCap`).
 *
 * @param {*} scale - A `scalePoint` or `scaleBand` with a `.step()` method.
 * @param {number} [maxJitterCap=16] - Maximum absolute jitter in pixels.
 * @returns {(index: number, axisSeed: number) => number}
 */
export function buildCategoryJitterScale(scale, maxJitterCap = 16) {
	const baseStep = Number.isFinite(scale?.step?.()) ? scale.step() : 0;
	const jitterMax = Math.max(0, Math.min(maxJitterCap, baseStep * 0.24));
	return (index, axisSeed) => deterministicJitter(index, axisSeed) * jitterMax;
}

/**
 * Truncate a category tick label to `maxLength` chars, appending an
 * ellipsis when truncated.
 *
 * @param {*} value
 * @param {number} [maxLength=20]
 * @returns {string}
 */
export function truncateCategoryTick(value, maxLength = 20) {
	const text = String(value);
	if (text.length <= maxLength) return text;
	return `${text.slice(0, Math.max(1, maxLength - 1))}…`;
}

/**
 * Find the longest stringified value across `points[].[key]`.
 *
 * @param {Array<Object<string, *>>} points
 * @param {string} key
 * @returns {number}
 */
export function estimateLongestCategoryLength(points, key) {
	return points.reduce((maxLength, point) => Math.max(maxLength, String(point[key] || '').length), 0);
}

/**
 * Grow the left/bottom margins when the corresponding axis is categorical,
 * so long category labels do not get clipped. Returns a new object — does
 * not mutate `baseMargins`.
 *
 * @param {{ top: number, right: number, bottom: number, left: number }} baseMargins
 * @param {Array<Object<string, *>>} points
 * @param {{ x: string, y: string }} axisTypes - Values from {@link AXIS_TYPE_VALUES}.
 * @returns {{ top: number, right: number, bottom: number, left: number }}
 */
export function computeAdaptiveMargins(baseMargins, points, axisTypes) {
	const margins = { ...baseMargins };

	if (axisTypes.y === AXIS_TYPE_VALUES.categorical) {
		const maxYLength = estimateLongestCategoryLength(points, 'yCategory');
		const estimatedLeft = 28 + (Math.min(maxYLength, 64) * 6.8);
		margins.left = Math.max(baseMargins.left, Math.min(340, Math.round(estimatedLeft)));
	}

	if (axisTypes.x === AXIS_TYPE_VALUES.categorical) {
		const maxXLength = estimateLongestCategoryLength(points, 'xCategory');
		const estimatedBottom = 48 + (Math.min(maxXLength, 52) * 4.2);
		margins.bottom = Math.max(baseMargins.bottom, Math.min(250, Math.round(estimatedBottom)));
	}

	return margins;
}

/**
 * Bucket points by `(xCategory, yCategory)`. Each output entry inherits
 * the first point's fields, gains `isAggregate: true`, and tracks the
 * underlying row count + raw row references. Used in
 * `categoricalPairMode === 'aggregate'`.
 *
 * @param {Array<Object<string, *>>} points - Each must have `xCategory`, `yCategory`, `index`, `raw`.
 * @returns {Array<Object<string, *>>}
 */
export function aggregateCategoricalPairs(points) {
	const groups = new Map();

	points.forEach(point => {
		const key = `${point.xCategory}${point.yCategory}`;
		if (!groups.has(key)) {
			groups.set(key, {
				...point,
				isAggregate: true,
				count: 0,
				rawRows: [],
			});
		}

		const group = groups.get(key);
		group.count += 1;
		group.rawRows.push(point.raw);

		if (point.index < group.index) {
			group.index = point.index;
			group.raw = point.raw;
		}
	});

	return Array.from(groups.values());
}

/**
 * Find the most-frequent normalized value of `rows[].[fieldName]`. Ties
 * broken alphabetically by {@link compareStrings} so the result is stable.
 * Returns `'—'` when `rows` is empty.
 *
 * @param {Array<Object<string, *>>} rows
 * @param {string} fieldName
 * @returns {string}
 */
export function pickMostFrequentCategory(rows, fieldName) {
	const categoryCount = new Map();

	rows.forEach(row => {
		const category = normalizeCategoryValue(row?.[fieldName]);
		categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
	});

	let bestCategory = '—';
	let bestCount = -1;
	for (const [category, count] of categoryCount.entries()) {
		if (count > bestCount) {
			bestCategory = category;
			bestCount = count;
			continue;
		}
		if (count === bestCount && compareStrings(category, bestCategory) < 0) {
			bestCategory = category;
		}
	}

	return bestCategory;
}

/**
 * Normalize a numeric extent so D3 scales don't degenerate. Returns
 * `[0, 1]` when either bound is non-finite; pads by 10% (or by 1 when
 * the bound is 0) when `min === max`. Otherwise returns the input.
 *
 * @param {[number, number]} extent
 * @returns {[number, number]}
 */
export function normalizarDominio([minimo, maximo]) {
	if (!Number.isFinite(minimo) || !Number.isFinite(maximo)) return [0, 1];
	if (minimo === maximo) {
		const delta = minimo === 0 ? 1 : Math.abs(minimo * 0.1);
		return [minimo - delta, maximo + delta];
	}
	return [minimo, maximo];
}
