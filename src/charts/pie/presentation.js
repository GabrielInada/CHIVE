/**
 * Shared pie-chart presentation flow.
 *
 * Workspace and panel integrations both map their config into the same SVG
 * renderer contract. Localized labels stay here so the renderer remains
 * stateless and i18n-free.
 */

import { t, getLocale } from '../../services/i18nService.js';
import { renderPieChart } from './renderers/svg.js';

const EMPTY_FILTER_CALLBACKS = Object.freeze({});

/**
 * Render a pie chart from a live config block or captured panel snapshot.
 *
 * @param {HTMLElement} container
 * @param {Array<Object<string, *>>} rows
 * @param {Object} [config]
 * @param {Object} [filterCallbacks]
 * @returns {import('../../types.js').Result}
 */
export function renderPieInto(
	container,
	rows,
	config = {},
	filterCallbacks = EMPTY_FILTER_CALLBACKS,
) {
	return renderPieChart(container, rows, config.category, {
		customTitle: config.customTitle,
		chartHeight: config.chartHeight,
		measureMode: config.measureMode,
		valueColumn: config.valueColumn,
		innerRadius: config.innerRadius,
		outerRadius: config.outerRadius,
		padAngle: config.padAngle,
		zoomScale: config.zoomScale,
		topN: config.topN,
		topNMode: config.topNMode,
		color: config.color,
		showCategoryLabel: config.showCategoryLabel,
		showValueLabel: config.showValueLabel,
		showLegend: config.showLegend,
		labelPosition: config.labelPosition,
		customSliceColors: config.customSliceColors,
		locale: getLocale(),
		labels: {
			category: t('chive-chart-control-pie-category'),
			count: t('chive-tooltip-count'),
			percentage: t('chive-tooltip-percentage'),
			other: t('chive-chart-pie-other'),
			focusOnThis: t('chive-tooltip-show-only-this'),
			addToFilter: t('chive-tooltip-add-to-filter'),
		},
		filterCallbacks,
	});
}
