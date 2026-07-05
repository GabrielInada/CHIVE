/**
 * Bubble-chart section adapter. See `barChartSection.js` for the pattern.
 */

import { t, getLocale } from '../../../services/i18nService.js';
import { renderBubbleChart } from '../../../modules/visualizations/bubbleChart.js';
import { CHART_CONTAINERS, CHART_BLOCKS } from '../../../config/elementIds.js';
import { showChartMessage } from './sharedRenderHelpers.js';

/**
 * Render the bubble-chart section. Surfaces `'no-value-column'`,
 * `'no-numeric'`, `'no-nesting-columns'`, and `'no-group-column'` as
 * distinct empty messages.
 *
 * @param {Object} args
 * @param {Object} args.config
 * @param {Array<Object<string, *>>} args.rows
 * @param {Object} args.filterCallbacks
 * @returns {void}
 */
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
				category: t('chive-chart-control-bubble-category'),
				count: t('chive-tooltip-count'),
				sum: t('chive-tooltip-sum'),
				mean: t('chive-tooltip-mean'),
				group: t('chive-chart-control-bubble-group'),
				children: t('chive-chart-control-bubble-node-children-count'),
				level: t('chive-chart-control-bubble-node-depth'),
			},
			filterCallbacks,
		}
	);

	if (!result.ok) {
		const key = result.reason === 'no-value-column' || result.reason === 'no-numeric'
			? 'chive-chart-empty-bubble-numeric'
			: result.reason === 'no-nesting-columns' || result.reason === 'no-group-column'
				? 'chive-chart-empty-bubble-nesting-required'
				: 'chive-chart-empty-bubble';
		showChartMessage(CHART_CONTAINERS.bubble, t(key));
	}
}
