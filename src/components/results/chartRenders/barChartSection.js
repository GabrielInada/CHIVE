/**
 * Bar-chart section adapter. Validates the bar config, looks up the section
 * DOM, builds the localized labels bag, delegates to {@link renderBarChart},
 * and surfaces a friendly "no data" message when the renderer fails.
 *
 * Mirror of the other `*ChartSection` modules in this directory.
 */

import { t, getLocale } from '../../../services/i18nService.js';
import { renderBarChart } from '../../../modules/visualizations/index.js';
import { CHART_CONTAINERS, CHART_BLOCKS } from '../../../config/elementIds.js';
import { showChartMessage } from './sharedRenderHelpers.js';

/**
 * Render the bar-chart section for the current dataset.
 *
 * @param {Object} args
 * @param {Object} args.config - The bar config block (`chartConfig.bar`).
 * @param {Array<Object<string, *>>} args.rows - Already filtered by the global filter.
 * @param {Object} args.filterCallbacks - Bag of tooltip filter action handlers.
 * @returns {void}
 */
export function renderBarChartSection({ config, rows, filterCallbacks }) {
	const block = document.getElementById(CHART_BLOCKS.bar);
	const container = document.getElementById(CHART_CONTAINERS.bar);
	if (!config.enabled) {
		block.style.display = 'none';
		container.replaceChildren();
		return;
	}
	block.style.display = 'block';
	container.style.minHeight = `${Number(config.chartHeight || 320)}px`;
	const measureMode = ['count', 'sum', 'mean'].includes(config.measureMode)
		? config.measureMode
		: 'count';
	const yAxisLabel = measureMode === 'mean'
		? t('chive-tooltip-mean')
		: measureMode === 'sum'
			? t('chive-tooltip-sum')
			: t('chive-tooltip-count');
	const result = renderBarChart(
		container,
		rows,
		config.category,
		{
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
		}
	);
	if (!result.ok) {
		const key = result.reason === 'no-numeric' || result.reason === 'no-value-column'
			? 'chive-chart-empty-bar-numeric'
			: 'chive-chart-empty-bar';
		showChartMessage(CHART_CONTAINERS.bar, t(key));
	}
}
