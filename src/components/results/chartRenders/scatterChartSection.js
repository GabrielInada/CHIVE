import { t, getLocale } from '../../../services/i18nService.js';
import { renderScatterPlot } from '../../../modules/visualizations/index.js';
import { CHART_CONTAINERS, CHART_BLOCKS } from '../../../config/elementIds.js';
import { showChartMessage } from './sharedRenderHelpers.js';

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
				eixoX: t('chive-chart-control-scatter-x'),
				eixoY: t('chive-chart-control-scatter-y'),
				indice: t('chive-tooltip-row'),
				count: t('chive-tooltip-count'),
			},
			xColumn: config.x,
			yColumn: config.y,
			filterCallbacks,
		}
	);
	if (!result.ok) {
		const chave = result.reason === 'log-no-positive'
			? 'chive-chart-empty-scatter-log'
			: 'chive-chart-empty-scatter';
		showChartMessage(CHART_CONTAINERS.scatter, t(chave));
	}
}
