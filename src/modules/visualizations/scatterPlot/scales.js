/**
 * Scatter-plot scale construction.
 *
 * Builds the x/y position scales (continuous for numeric axes, point scales
 * for categorical) and the `getPointX`/`getPointY` accessors that fold in
 * deterministic categorical jitter. Returns plain values and functions; no
 * DOM. Used by `scatterPlot.js`.
 */

import { extent, scaleLinear, scaleLog, scalePoint } from '../../../../vendor/d3/d3.js';
import {
	AXIS_TYPE_VALUES,
	buildCategoryDomain,
	buildCategoryJitterScale,
	normalizeDomain,
} from './axisHelpers.js';

/**
 * Construct the position scales and point accessors.
 *
 * @param {Object} params
 * @param {Array<Object<string, *>>} params.points - Prepared points.
 * @param {{x: string, y: string}} params.axisTypes - Axis-type enum values.
 * @param {string} params.effectiveXScaleType - `'linear'` or `'log'` (numeric x only).
 * @param {string} params.effectiveYScaleType - `'linear'` or `'log'` (numeric y only).
 * @param {number} params.innerWidth - Chart inner width.
 * @param {number} params.innerHeight - Chart inner height.
 * @param {boolean} params.shouldAggregateCategoricalPairs - Aggregate mode disables jitter.
 * @returns {{ xScale: Function, yScale: Function, getPointX: (point: Object) => number, getPointY: (point: Object) => number }}
 */
export function buildScatterScales({
	points,
	axisTypes,
	effectiveXScaleType,
	effectiveYScaleType,
	innerWidth,
	innerHeight,
	shouldAggregateCategoricalPairs,
}) {
	let xScale;
	if (axisTypes.x === AXIS_TYPE_VALUES.numeric) {
		const xDomain = normalizeDomain(extent(points, point => point.x));
		xScale = (effectiveXScaleType === 'log' ? scaleLog() : scaleLinear())
			.domain(xDomain)
			.nice()
			.range([0, innerWidth]);
	} else {
		xScale = scalePoint()
			.domain(buildCategoryDomain(points, 'xCategory'))
			.range([0, innerWidth])
			.padding(0.5);
	}

	let yScale;
	if (axisTypes.y === AXIS_TYPE_VALUES.numeric) {
		const yDomain = normalizeDomain(extent(points, point => point.y));
		yScale = (effectiveYScaleType === 'log' ? scaleLog() : scaleLinear())
			.domain(yDomain)
			.nice()
			.range([innerHeight, 0]);
	} else {
		yScale = scalePoint()
			.domain(buildCategoryDomain(points, 'yCategory'))
			.range([innerHeight, 0])
			.padding(0.5);
	}

	const xJitterFor = axisTypes.x === AXIS_TYPE_VALUES.categorical && !shouldAggregateCategoricalPairs
		? buildCategoryJitterScale(xScale)
		: () => 0;
	const yJitterFor = axisTypes.y === AXIS_TYPE_VALUES.categorical && !shouldAggregateCategoricalPairs
		? buildCategoryJitterScale(yScale)
		: () => 0;

	const getPointX = point => {
		if (axisTypes.x === AXIS_TYPE_VALUES.numeric) return xScale(point.x);
		return (xScale(point.xCategory) || 0) + xJitterFor(point.index, 1.7);
	};

	const getPointY = point => {
		if (axisTypes.y === AXIS_TYPE_VALUES.numeric) return yScale(point.y);
		return (yScale(point.yCategory) || 0) + yJitterFor(point.index, 2.3);
	};

	return { xScale, yScale, getPointX, getPointY };
}
