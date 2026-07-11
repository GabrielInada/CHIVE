/**
 * Shared scatter-plot presentation flow.
 *
 * Workspace and panel integrations both map their config into the same SVG
 * renderer contract. Localized labels stay here so the renderer remains
 * stateless and i18n-free. Column types are forwarded per axis so the
 * renderer can honor explicit numeric/categorical axis decisions, and the
 * data column names double as the click-to-filter columns.
 */

import { t, getLocale } from '../../services/i18nService.js';
import { renderScatterPlot } from './renderers/svg.js';

const EMPTY_FILTER_CALLBACKS = Object.freeze({});

/**
 * Render a scatter plot from a live config block or frozen panel snapshot.
 *
 * @param {HTMLElement} container
 * @param {Array<Object<string, *>>} rows
 * @param {Object} [config]
 * @param {Object<string, string>} [columnTypeByName] - Column name → `ColumnType`.
 * @param {Object} [filterCallbacks]
 * @returns {import('../../types.js').Result}
 */
export function renderScatterInto(
	container,
	rows,
	config = {},
	columnTypeByName = {},
	filterCallbacks = EMPTY_FILTER_CALLBACKS,
) {
	return renderScatterPlot(container, rows, config.x, config.y, {
		customTitle: config.customTitle,
		chartHeight: config.chartHeight,
		xScale: config.xScale,
		yScale: config.yScale,
		radius: config.radius,
		opacity: config.opacity,
		sizeMode: config.sizeMode,
		sizeField: config.sizeField,
		sizeMin: config.sizeMin,
		sizeMax: config.sizeMax,
		color: config.color,
		colorMode: config.colorMode,
		colorField: config.colorField,
		gradientMinColor: config.gradientMinColor,
		gradientMaxColor: config.gradientMaxColor,
		gradientDistribution: config.gradientDistribution,
		colorScheme: config.colorScheme,
		categoricalPairMode: config.categoricalPairMode,
		showXAxisLabel: config.showXAxisLabel,
		showYAxisLabel: config.showYAxisLabel,
		regression: config.regression,
		axisLabels: {
			x: config.x || t('chive-chart-control-scatter-x'),
			y: config.y || t('chive-chart-control-scatter-y'),
		},
		axisTypes: {
			x: columnTypeByName[config.x],
			y: columnTypeByName[config.y],
		},
		locale: getLocale(),
		labels: {
			xAxis: t('chive-chart-control-scatter-x'),
			yAxis: t('chive-chart-control-scatter-y'),
			index: t('chive-tooltip-row'),
			count: t('chive-tooltip-count'),
			regressionSlope: t('chive-chart-tooltip-regression-slope'),
			regressionIntercept: t('chive-chart-tooltip-regression-intercept'),
			regressionR2: t('chive-chart-tooltip-regression-r2'),
			regressionN: t('chive-chart-tooltip-regression-n'),
			regressionGroup: t('chive-chart-tooltip-regression-group'),
		},
		xColumn: config.x,
		yColumn: config.y,
		filterCallbacks,
	});
}
