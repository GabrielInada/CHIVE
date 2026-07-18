/**
 * Scatter-plot point preparation.
 *
 * Maps source rows into point records, infers each axis type, derives the
 * effective scale types, drops non-finite (and, on log axes, non-positive)
 * points, and optionally aggregates repeated categorical pairs. Pure: no DOM,
 * no d3. Used by `renderers/svg.js`.
 */

import { normalizeCategoryValue } from '../../domain/filters/chartFilter.js';
import {
	AXIS_TYPE_VALUES,
	inferAxisType,
	aggregateCategoricalPairs,
} from './axisHelpers.js';

/**
 * Build the rendered point set and the axis/scale context derived from it.
 *
 * The caller decides the empty-state outcome: when the returned `points` is
 * empty, a `log` effective scale type signals the `'log-no-positive'` case.
 *
 * @param {Object} params
 * @param {Array<Object<string, *>>} params.rows - Source rows.
 * @param {string} params.xColumn - X data column name.
 * @param {string} params.yColumn - Y data column name.
 * @param {'linear'|'log'} params.xScaleType - Configured x scale type.
 * @param {'linear'|'log'} params.yScaleType - Configured y scale type.
 * @param {'jitter'|'aggregate'} params.categoricalPairMode - Two-categorical-axis strategy.
 * @param {{x?: string, y?: string}} params.configuredAxisTypes - Optional explicit axis types.
 * @returns {{ points: Array<Object<string, *>>, axisTypes: {x: string, y: string}, effectiveXScaleType: string, effectiveYScaleType: string, shouldAggregateCategoricalPairs: boolean }}
 */
export function buildScatterPoints({
	rows,
	xColumn,
	yColumn,
	xScaleType,
	yScaleType,
	categoricalPairMode,
	configuredAxisTypes,
}) {
	let points = rows.map((row, index) => ({
		xRaw: row?.[xColumn],
		yRaw: row?.[yColumn],
		x: Number(row?.[xColumn]),
		y: Number(row?.[yColumn]),
		xCategory: normalizeCategoryValue(row?.[xColumn]),
		yCategory: normalizeCategoryValue(row?.[yColumn]),
		index,
		raw: row,
	}));

	const axisTypes = {
		x: inferAxisType(points.map(point => point.xRaw), configuredAxisTypes.x),
		y: inferAxisType(points.map(point => point.yRaw), configuredAxisTypes.y),
	};

	const effectiveXScaleType = axisTypes.x === AXIS_TYPE_VALUES.numeric
		? xScaleType
		: 'linear';
	const effectiveYScaleType = axisTypes.y === AXIS_TYPE_VALUES.numeric
		? yScaleType
		: 'linear';

	points = points.filter(point => {
		if (axisTypes.x === AXIS_TYPE_VALUES.numeric && !Number.isFinite(point.x)) return false;
		if (axisTypes.y === AXIS_TYPE_VALUES.numeric && !Number.isFinite(point.y)) return false;
		return true;
	});

	if (effectiveXScaleType === 'log') {
		points = points.filter(point => point.x > 0);
	}

	if (effectiveYScaleType === 'log') {
		points = points.filter(point => point.y > 0);
	}

	const shouldAggregateCategoricalPairs = (
		axisTypes.x === AXIS_TYPE_VALUES.categorical
		&& axisTypes.y === AXIS_TYPE_VALUES.categorical
		&& categoricalPairMode === 'aggregate'
	);

	if (shouldAggregateCategoricalPairs) {
		points = aggregateCategoricalPairs(points);
	}

	return {
		points,
		axisTypes,
		effectiveXScaleType,
		effectiveYScaleType,
		shouldAggregateCategoricalPairs,
	};
}
