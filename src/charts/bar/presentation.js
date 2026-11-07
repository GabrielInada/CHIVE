/**
 * Shared bar-chart presentation flow.
 *
 * Workspace and panel integrations both map their config into the same SVG
 * renderer contract. This flow also shows localized empty states on both surfaces.
 * Localized labels stay here so the renderer remains
 * stateless and i18n-free.
 */

import { t, getLocale } from '../../services/i18nService.js';
import { showChartMessage } from '../shared/containerLifecycle.js';
import { measureLabelKey } from '../shared/measure.js';
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
	const result = renderBarChart(container, rows, config.category, {
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
		measureMode: config.measureMode,
		valueColumn: config.valueColumn,
		showXAxisLabel: config.showXAxisLabel,
		showYAxisLabel: config.showYAxisLabel,
		axisLabels: {
			x: config.category || t('chive-chart-control-bar-category'),
		},
		locale: getLocale(),
		labels: {
			close: t('chive-tooltip-close'),
			category: t('chive-chart-control-bar-category'),
			measure: t(measureLabelKey(config.measureMode)),
			percentage: t('chive-tooltip-percentage'),
			missing: t('chive-chart-filter-missing'),
		},
		filterCallbacks,
	});

	if (!result.ok) {
		const key = result.reason === 'no-numeric' || result.reason === 'no-value-column'
			? 'chive-chart-empty-bar-numeric'
			: 'chive-chart-empty-bar';
		showChartMessage(container, t(key));
	}
	return result;
}
