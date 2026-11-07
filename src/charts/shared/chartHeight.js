/**
 * The height a chart is drawn at, from its stored `chartHeight`.
 *
 * Each chart definition owns its height limits and its default height (the
 * `chartHeight` of a fresh config). Visualizations sizes the chart container
 * with this, so the container is as tall as the chart drawn inside it.
 */

import { CHART_DEFINITIONS } from '../../config/charts/definitions.js';
import { clamp } from '../../utils/formatters.js';

/** @type {Readonly<Object<string, number>>} */
const DEFAULT_CHART_HEIGHTS = Object.freeze(Object.fromEntries(
	Object.values(CHART_DEFINITIONS).map(({ key, createDefaultConfig }) => [key, createDefaultConfig().chartHeight]),
));

/**
 * Clamp a stored chart height to the chart's limits. A value that is not a
 * number gives the chart's default height. Matches the renderers, which read
 * `chartHeight` the same way.
 *
 * @param {import('../../types.js').ChartTypeKey} chartType
 * @param {*} chartHeight - The stored `chartHeight`, possibly missing or malformed.
 * @returns {number} Height in pixels.
 */
export function resolveChartHeight(chartType, chartHeight) {
	const { min, max } = CHART_DEFINITIONS[chartType].heightLimits;
	const height = Number(chartHeight);
	return Number.isFinite(height) ? clamp(height, min, max) : DEFAULT_CHART_HEIGHTS[chartType];
}
