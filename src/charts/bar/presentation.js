/**
 * Shared bar-chart presentation flow.
 *
 * Workspace and panel integrations both map their config into the same SVG
 * renderer contract. Localized labels stay here so the renderer remains
 * stateless and i18n-free.
 */

import { t, getLocale } from '../../services/i18nService.js';
import { renderBarChart } from './renderers/svg.js';

const EMPTY_FILTER_CALLBACKS = Object.freeze({});

/**
 * Render a bar chart from a live config block or captured panel snapshot.
 *
 * @param {HTMLElement} container
 * @param {Array<Object<string, *>>} rows
 * @param {Object} [config]
 * @param {Object} [filterCallbacks]
 * @returns {import('../../types.js').Result}
 */
export function renderBarInto(
	container,
	rows,
	config = {},
	filterCallbacks = EMPTY_FILTER_CALLBACKS,
) {
	const measureMode = ['count', 'sum', 'mean'].includes(config.measureMode)
		? config.measureMode
		: 'count';
	const yAxisLabel = measureMode === 'mean'
		? t('chive-tooltip-mean')
		: measureMode === 'sum'
			? t('chive-tooltip-sum')
			: t('chive-tooltip-count');

	return renderBarChart(container, rows, config.category, {
		customTitle: config.customTitle,
		chartHeight: config.chartHeight,
		sort: config.sort,
		topN: config.topN,
		color: config.color,
		colorMode: config.colorMode,
		gradientMinColor: config.gradientMinColor,
		gradientMaxColor: config.gradientMaxColor,
		gradientDistribution: config.gradientDistribution,
		manualThresholdPct: config.manualThresholdPct,
		measureMode,
		valueColumn: config.valueColumn,
		showXAxisLabel: config.showXAxisLabel,
		showYAxisLabel: config.showYAxisLabel,
		axisLabels: {
			x: config.category || t('chive-chart-control-bar-category'),
			y: yAxisLabel,
		},
		locale: getLocale(),
		labels: {
			category: t('chive-chart-control-bar-category'),
			count: t('chive-tooltip-count'),
			sum: t('chive-tooltip-sum'),
			mean: t('chive-tooltip-mean'),
			percentage: t('chive-tooltip-percentage'),
			focusOnThis: t('chive-tooltip-show-only-this'),
			addToFilter: t('chive-tooltip-add-to-filter'),
		},
		filterCallbacks,
	});
}
