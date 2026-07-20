/**
 * Shared bubble-chart presentation flow.
 *
 * Workspace and panel integrations both map their config into the same SVG
 * renderer contract. Localized labels stay here so the renderer remains
 * stateless and i18n-free.
 */

import { BUBBLE_CHART } from '../../config/charts/definitions/bubble.js';
import { t, getLocale } from '../../services/i18nService.js';
import { renderBubbleChart } from './renderers/svg.js';

const EMPTY_FILTER_CALLBACKS = Object.freeze({});

/**
 * Render a bubble chart from a live config block or frozen panel snapshot.
 *
 * @param {HTMLElement} container
 * @param {Array<Object<string, *>>} rows
 * @param {Object} [config]
 * @param {Object} [filterCallbacks]
 * @returns {import('../../types.js').Result}
 */
export function renderBubbleInto(
	container,
	rows,
	config = {},
	filterCallbacks = EMPTY_FILTER_CALLBACKS,
) {
	const measureMode = BUBBLE_CHART.measureModes.includes(config.measureMode)
		? config.measureMode
		: BUBBLE_CHART.defaultMeasureMode;

	return renderBubbleChart(container, rows, config.category, {
		customTitle: config.customTitle,
		chartHeight: config.chartHeight,
		topN: config.topN,
		measureMode,
		valueColumn: config.valueColumn,
		nestingColumns: config.nestingColumns,
		groupColumn: config.groupColumn,
		nestingMode: config.nestingMode,
		padding: config.padding,
		labelMode: config.labelMode,
		colorScheme: config.colorScheme,
		locale: getLocale(),
		labels: {
			category: t('chive-chart-control-bubble-category'),
			count: t('chive-tooltip-count'),
			sum: t('chive-tooltip-sum'),
			mean: t('chive-tooltip-mean'),
			group: t('chive-chart-control-bubble-group'),
			children: t('chive-chart-control-bubble-node-children-count'),
			level: t('chive-chart-control-bubble-node-depth'),
		},
		filterCallbacks,
	});
}
