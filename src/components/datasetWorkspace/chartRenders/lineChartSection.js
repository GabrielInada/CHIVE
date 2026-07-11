/**
 * Line-chart section adapter. See `charts/bar/workspaceSection.js` for the package pattern.
 */

import { t, getLocale } from '../../../services/i18nService.js';
import { renderLineChart } from '../../../modules/visualizations/lineChart.js';
import { CHART_CONTAINERS, CHART_BLOCKS } from '../../../config/elementIds.js';
import { clearChartContainer, showChartMessage } from '../../../utils/chartContainerLifecycle.js';

/**
 * Render the line-chart section. `columnTypeByName` is forwarded so the
 * renderer can decide between numeric, point, and time scales.
 *
 * @param {Object} args
 * @param {Object} args.config
 * @param {Array<Object<string, *>>} args.rows
 * @param {Object<string, string>} args.columnTypeByName - Column name → `ColumnType`.
 * @param {Object} args.filterCallbacks
 * @returns {void}
 */
export function renderLineChartSection({ config, rows, columnTypeByName, filterCallbacks }) {
	const block = document.getElementById(CHART_BLOCKS.line);
	const container = document.getElementById(CHART_CONTAINERS.line);
	if (!config.enabled) {
		block.style.display = 'none';
		clearChartContainer(container);
		return;
	}
	block.style.display = 'block';
	container.style.minHeight = `${Number(config.chartHeight || 320)}px`;
	const result = renderLineChart(
		container,
		rows,
		config.x,
		config.y,
		{
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
		}
	);
	if (!result.ok) {
		const chave = result.reason === 'no-numeric'
			? 'chive-chart-empty-line-numeric'
			: result.reason === 'no-x-values'
				? 'chive-chart-empty-line-x'
				: 'chive-chart-empty-line';
		showChartMessage(CHART_CONTAINERS.line, t(chave));
	}
}
