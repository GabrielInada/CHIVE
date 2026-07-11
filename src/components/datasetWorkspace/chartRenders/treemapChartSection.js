/**
 * Treemap section adapter. See `charts/bar/workspaceSection.js` for the package pattern.
 */

import { t, getLocale } from '../../../services/i18nService.js';
import { renderTreeMap } from '../../../modules/visualizations/treemapChart.js';
import { CHART_CONTAINERS, CHART_BLOCKS } from '../../../config/elementIds.js';
import { clearChartContainer, showChartMessage } from '../../../utils/chartContainerLifecycle.js';

/**
 * Render the treemap section. The underlying renderer returns `void`, so
 * this section does not surface a friendly fail message (unlike the others).
 *
 * @param {Object} args
 * @param {Object} args.config
 * @param {Array<Object<string, *>>} args.rows
 * @param {Object} args.filterCallbacks
 * @returns {void}
 */
export function renderTreemapChartSection({ config, rows, filterCallbacks }) {
	const block = document.getElementById(CHART_BLOCKS.treemap);
	const container = document.getElementById(CHART_CONTAINERS.treemap);
	if (!config.enabled) {
		block.style.display = 'none';
		clearChartContainer(container);
		return;
	}
	block.style.display = 'block';
	container.style.minHeight = `${Number(config.chartHeight || 380)}px`;
	const result = renderTreeMap(
		container,
		rows,
		config.category,
		{
			customTitle: config.customTitle,
			chartHeight: config.chartHeight,
			measureMode: config.measureMode,
			valueColumn: config.valueColumn,
			topN: config.topN,
			padding: config.padding,
			showLabels: config.showLabels,
			showValues: config.showValues,
			color: config.color,
			colorMode: config.colorMode,
			colorScheme: config.colorScheme,
			locale: getLocale(),
			labels: {
				category: t('chive-chart-control-treemap-category'),
				count: t('chive-tooltip-count'),
				sum: t('chive-tooltip-sum'),
				percentage: t('chive-tooltip-percentage'),
				focusOnThis: t('chive-tooltip-show-only-this'),
				addToFilter: t('chive-tooltip-add-to-filter'),
			},
			filterCallbacks,
		}
	);

	if (!result.ok) {
		const key = result.reason === 'no-value-column'
			? 'chive-chart-empty-treemap-numeric'
			: 'chive-chart-empty-treemap';
		showChartMessage(CHART_CONTAINERS.treemap, t(key));
	}
}
