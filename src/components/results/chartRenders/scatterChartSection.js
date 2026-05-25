/**
 * Scatter-plot section adapter. See `barChartSection.js` for the pattern.
 */

import { t, getLocale } from '../../../services/i18nService.js';
import { renderScatterPlot } from '../../../modules/visualizations/index.js';
import { CHART_CONTAINERS, CHART_BLOCKS } from '../../../config/elementIds.js';
import { showChartMessage } from './sharedRenderHelpers.js';

/**
 * Render the scatter-plot section.
 *
 * @param {Object} args
 * @param {Object} args.config
 * @param {Array<Object<string, *>>} args.rows
 * @param {Object<string, string>} args.columnTypeByName - Column name → `ColumnType`.
 * @param {Object} args.filterCallbacks
 * @returns {void}
 */
export function renderScatterChartSection({ config, rows, columnTypeByName, filterCallbacks }) {
	const block = document.getElementById(CHART_BLOCKS.scatter);
	const container = document.getElementById(CHART_CONTAINERS.scatter);
	if (!config.enabled) {
		block.style.display = 'none';
		container.replaceChildren();
		return;
	}
	block.style.display = 'block';
	container.style.minHeight = `${Number(config.chartHeight || 320)}px`;
	const result = renderScatterPlot(
		container,
		rows,
		config.x,
		config.y,
		{
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
		}
	);
	if (!result.ok) {
		const key = result.reason === 'log-no-positive'
			? 'chive-chart-empty-scatter-log'
			: 'chive-chart-empty-scatter';
		showChartMessage(CHART_CONTAINERS.scatter, t(key));
	}
}
