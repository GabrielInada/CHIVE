import { t, getLocale } from '../../../services/i18nService.js';
import { renderBubbleChart } from '../../../modules/visualizations/index.js';
import { CHART_CONTAINERS, CHART_BLOCKS } from '../../../config/elementIds.js';
import { showChartMessage } from './sharedRenderHelpers.js';

export function renderBubbleChartSection({ config, rows, filterCallbacks }) {
	const block = document.getElementById(CHART_BLOCKS.bubble);
	const container = document.getElementById(CHART_CONTAINERS.bubble);
	if (!config.enabled) {
		block.style.display = 'none';
		container.replaceChildren();
		return;
	}
	block.style.display = 'block';
	container.style.minHeight = `${Number(config.chartHeight || 700)}px`;
	const measureMode = ['count', 'sum', 'mean'].includes(config.measureMode)
		? config.measureMode
		: 'count';
	const result = renderBubbleChart(
		container,
		rows,
		config.category,
		{
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
				categoria: t('chive-chart-control-bubble-category'),
				contagem: t('chive-tooltip-count'),
				soma: t('chive-tooltip-sum'),
				media: t('chive-tooltip-mean'),
				grupo: t('chive-chart-control-bubble-group'),
				filhos: t('chive-chart-control-bubble-node-children-count'),
				nivel: t('chive-chart-control-bubble-node-depth'),
			},
			filterCallbacks,
		}
	);

	if (!result.ok) {
		const chave = result.reason === 'no-value-column' || result.reason === 'no-numeric'
			? 'chive-chart-empty-bubble-numeric'
			: result.reason === 'no-nesting-columns' || result.reason === 'no-group-column'
				? 'chive-chart-empty-bubble-nesting-required'
				: 'chive-chart-empty-bubble';
		showChartMessage(CHART_CONTAINERS.bubble, t(chave));
	}
}
