/**
 * Shared pie-chart presentation flow.
 *
 * Workspace and panel integrations both map their config into the same SVG
 * renderer contract. This flow also shows localized empty states on both surfaces.
 * Localized labels stay here so the renderer remains
 * stateless and i18n-free.
 */

import { t, getLocale } from '../../services/i18nService.js';
import { showChartMessage } from '../shared/containerLifecycle.js';
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
	const result = renderPieChart(container, rows, config.category, {
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
			close: t('chive-tooltip-close'),
			category: t('chive-chart-control-pie-category'),
			count: t('chive-tooltip-count'),
			sum: t('chive-tooltip-sum'),
			percentage: t('chive-tooltip-percentage'),
			other: t('chive-chart-pie-other'),
			missing: t('chive-chart-filter-missing'),
		},
		filterCallbacks,
	});

	if (!result.ok) {
		const key = result.reason === 'no-numeric' || result.reason === 'no-value-column'
			? 'chive-chart-empty-pie-sum'
			: result.reason === 'no-positive-value'
				? 'chive-chart-empty-no-positive-sum'
				: 'chive-chart-empty-pie';
		showChartMessage(container, t(key));
	}
	return result;
}
