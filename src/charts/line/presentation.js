/**
 * Shared line-chart presentation flow.
 *
 * Workspace and panel integrations both map their config into the same SVG
 * renderer contract. Localized labels stay here so the renderer remains
 * stateless and i18n-free. The x-axis column type is forwarded so the
 * renderer can decide between numeric, point, and time scales.
 */

import { t, getLocale } from '../../services/i18nService.js';
import { renderLineChart } from './renderers/svg.js';

const EMPTY_FILTER_CALLBACKS = Object.freeze({});

/**
 * Render a line chart from a live config block or captured panel snapshot.
 *
 * @param {HTMLElement} container
 * @param {Array<Object<string, *>>} rows
 * @param {Object} [config]
 * @param {Object<string, string>} [columnTypeByName] - Column name → `ColumnType`.
 * @param {Object} [filterCallbacks]
 * @returns {import('../../types.js').Result}
 */
export function renderLineInto(
	container,
	rows,
	config = {},
	columnTypeByName = {},
	filterCallbacks = EMPTY_FILTER_CALLBACKS,
) {
	return renderLineChart(container, rows, config.x, config.y, {
		customTitle: config.customTitle,
		chartHeight: config.chartHeight,
		curve: config.curve,
		missingMode: config.missingMode,
		strokeWidth: config.strokeWidth,
		color: config.color,
		ghostStrokeColor: config.ghostStrokeColor,
		showPoints: config.showPoints,
		sortX: config.sortX,
		aggregateMode: config.aggregateMode,
		showXAxisLabel: config.showXAxisLabel,
		showYAxisLabel: config.showYAxisLabel,
		axisLabels: {
			x: config.x || t('chive-chart-control-line-x'),
			y: config.y || t('chive-chart-control-line-y'),
		},
		axisTypes: {
			x: columnTypeByName[config.x],
			y: columnTypeByName[config.y],
		},
		locale: getLocale(),
		filterCallbacks,
	});
}
