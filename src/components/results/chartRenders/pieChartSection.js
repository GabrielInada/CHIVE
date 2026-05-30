/**
 * Pie-chart section adapter. See `barChartSection.js` for the pattern.
 */

import { t, getLocale } from '../../../services/i18nService.js';
import { renderPieChart } from '../../../modules/visualizations/index.js';
import { CHART_CONTAINERS, CHART_BLOCKS } from '../../../config/elementIds.js';
import { showChartMessage } from './sharedRenderHelpers.js';

/**
 * Render the pie-chart section.
 *
 * @param {Object} args
 * @param {Object} args.config
 * @param {Array<Object<string, *>>} args.rows
 * @param {Object} args.filterCallbacks
 * @returns {void}
 */
export function renderPieChartSection({ config, rows, filterCallbacks }) {
	const block = document.getElementById(CHART_BLOCKS.pie);
	const container = document.getElementById(CHART_CONTAINERS.pie);
	if (!config.enabled) {
		block.style.display = 'none';
		container.replaceChildren();
		return;
	}
	block.style.display = 'block';
	container.style.minHeight = `${Number(config.chartHeight || 360)}px`;
	const result = renderPieChart(
		container,
		rows,
		config.category,
		{
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
		}
	);

	if (!result.ok) {
		const key = result.reason === 'sum-no-numeric'
			? 'chive-chart-empty-pie-sum'
			: 'chive-chart-empty-pie';
		showChartMessage(CHART_CONTAINERS.pie, t(key));
	}
}
