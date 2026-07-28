/**
 * Scatter-plot visual encoding.
 *
 * Owns the qualitative category palettes (single source of truth, frozen so
 * callers cannot mutate them) and builds the point-size and point-color
 * accessors used by `renderers/svg.js`. Pure: no DOM, returns plain functions
 * and lookup maps.
 */

import { scaleSqrt } from '../../../vendor/d3/d3.js';
import { interpolateColor, buildRankMap } from '../../utils/colorUtils.js';
import { toFiniteNumber } from '../../utils/formatters.js';
import { normalizeCategoryValue } from '../../domain/filters/chartFilter.js';
import { pickMostFrequentCategory } from './axisHelpers.js';
import { getScatterPalette } from './palettes.js';

/**
 * Build the per-point radius accessor. Aggregate bubbles size by their count
 * (linearly between `radius` and a derived max); numeric size mode uses a
 * `scaleSqrt` (area-true) from the size column's extent to `[sizeMin, sizeMax]`;
 * otherwise every point uses the base `radius`.
 *
 * @param {Object} params
 * @param {Array<Object<string, *>>} params.points
 * @param {'uniform'|'numeric'} params.sizeMode
 * @param {?string} params.sizeField
 * @param {number} params.sizeMin
 * @param {number} params.sizeMax
 * @param {number} params.radius - Base radius.
 * @param {boolean} params.shouldAggregateCategoricalPairs
 * @returns {(point: Object) => number}
 */
export function buildRadiusAccessor({
	points,
	sizeMode,
	sizeField,
	sizeMin,
	sizeMax,
	radius,
	shouldAggregateCategoricalPairs,
}) {
	const aggregatedCounts = points
		.filter(point => point.isAggregate)
		.map(point => Number(point.count) || 0);
	const minAggregatedCount = aggregatedCounts.length > 0 ? Math.min(...aggregatedCounts) : 1;
	const maxAggregatedCount = aggregatedCounts.length > 0 ? Math.max(...aggregatedCounts) : 1;
	const maxAggregateRadius = Math.max(radius + 6, radius * 2.1);

	let sizeScale = null;
	if (sizeMode === 'numeric' && sizeField && !shouldAggregateCategoricalPairs) {
		const sizeValues = points
			.map(point => toFiniteNumber(point.raw?.[sizeField]))
			.filter(Number.isFinite);
		if (sizeValues.length > 0) {
			const minV = Math.min(...sizeValues);
			const maxV = Math.max(...sizeValues);
			// scaleSqrt so visual area scales with value (correct human perception).
			const domain = minV === maxV ? [minV - 1, maxV + 1] : [minV, maxV];
			sizeScale = scaleSqrt().domain(domain).range([sizeMin, sizeMax]);
		}
	}

	return point => {
		if (point.isAggregate) {
			if (maxAggregatedCount === minAggregatedCount) return maxAggregateRadius;
			const progress = ((point.count || minAggregatedCount) - minAggregatedCount) / (maxAggregatedCount - minAggregatedCount);
			return radius + ((maxAggregateRadius - radius) * progress);
		}
		if (sizeScale) {
			const v = toFiniteNumber(point.raw?.[sizeField]);
			if (Number.isFinite(v)) return sizeScale(v);
		}
		return radius;
	};
}

/**
 * Build the per-point color accessor. Uniform mode returns the base color;
 * numeric mode interpolates a value- or rank-driven gradient; category mode
 * assigns palette hues per distinct category (aggregate points use their most
 * frequent category). The `categoryMap` and `getCategoryColorValue` outputs
 * are reused by the regression layer for per-category coloring.
 *
 * @param {Object} params
 * @param {Array<Object<string, *>>} params.points
 * @param {'uniform'|'numeric'|'category'} params.colorMode
 * @param {?string} params.colorField
 * @param {string} params.color - Base/fallback color.
 * @param {string} params.gradientMinColor
 * @param {string} params.gradientMaxColor
 * @param {string} params.colorScheme
 * @param {'value'|'rank'} params.gradientDistribution
 * @returns {{ getPointColor: (point: Object) => string, categoryMap: ?Map<*, string>, getCategoryColorValue: ?(point: Object) => * }}
 */
export function buildColorAccessor({
	points,
	colorMode,
	colorField,
	color,
	gradientMinColor,
	gradientMaxColor,
	colorScheme,
	gradientDistribution,
}) {
	let getPointColor = () => color;
	if (colorMode === 'numeric' && colorField) {
		const getNumericColorValue = point => {
			if (!point.isAggregate) {
				return toFiniteNumber(point.raw?.[colorField]);
			}
			const values = (point.rawRows || [])
				.map(row => toFiniteNumber(row?.[colorField]))
				.filter(Number.isFinite);
			if (values.length === 0) return NaN;
			return values.reduce((acc, value) => acc + value, 0) / values.length;
		};

		const numericValues = points
			.map(point => getNumericColorValue(point))
			.filter(Number.isFinite);
		if (numericValues.length > 0) {
			const min = Math.min(...numericValues);
			const max = Math.max(...numericValues);
			const delta = max - min || 1;
			if (gradientDistribution === 'rank') {
				const rankMap = buildRankMap(points, point => getNumericColorValue(point));
				const rankDenom = Math.max(rankMap.size - 1, 1);
				getPointColor = point => {
					const rank = rankMap.get(point);
					if (rank === undefined) return color;
					return interpolateColor(gradientMinColor, gradientMaxColor, rank / rankDenom);
				};
			} else {
				getPointColor = point => {
					const v = getNumericColorValue(point);
					if (!Number.isFinite(v)) return color;
					return interpolateColor(gradientMinColor, gradientMaxColor, (v - min) / delta);
				};
			}
		}
	}

	let getCategoryColorValue = null;
	let categoryMap = null;
	if (colorMode === 'category' && colorField) {
		getCategoryColorValue = point => {
			if (!point.isAggregate) {
				return normalizeCategoryValue(point.raw?.[colorField]);
			}
			return pickMostFrequentCategory(point.rawRows || [], colorField);
		};

		const palette = getScatterPalette(colorScheme);
		categoryMap = new Map();
		points.forEach(point => {
			const cat = getCategoryColorValue(point);
			if (!categoryMap.has(cat)) {
				categoryMap.set(cat, palette[categoryMap.size % palette.length]);
			}
		});
		getPointColor = point => {
			const cat = getCategoryColorValue(point);
			return categoryMap.get(cat) || color;
		};
	}

	return { getPointColor, categoryMap, getCategoryColorValue };
}
