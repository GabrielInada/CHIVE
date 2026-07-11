/**
 * Network-graph section adapter. See `charts/bar/workspaceSection.js` for the package pattern.
 */

import { t, getLocale } from '../../../services/i18nService.js';
import { renderNetworkGraph } from '../../../modules/visualizations/networkGraph.js';
import { CHART_CONTAINERS, CHART_BLOCKS } from '../../../config/elementIds.js';
import { clearChartContainer, showChartMessage } from '../../../utils/chartContainerLifecycle.js';

/**
 * Render the network-graph section.
 *
 * @param {Object} args
 * @param {Object} args.config
 * @param {Array<Object<string, *>>} args.rows
 * @param {Object} args.filterCallbacks
 * @returns {void}
 */
export function renderNetworkChartSection({ config, rows, filterCallbacks }) {
	const block = document.getElementById(CHART_BLOCKS.network);
	const container = document.getElementById(CHART_CONTAINERS.network);
	if (!config.enabled) {
		block.style.display = 'none';
		clearChartContainer(container);
		return;
	}
	block.style.display = 'block';
	container.style.minHeight = `${Number(config.chartHeight || 420)}px`;
	const result = renderNetworkGraph(
		container,
		rows,
		config.source,
		config.target,
		{
			customTitle: config.customTitle,
			chartHeight: config.chartHeight,
			weightColumn: config.weight,
			groupColumn: config.group,
			nodeRadius: config.nodeRadius,
			linkDistance: config.linkDistance,
			chargeStrength: config.chargeStrength,
			linkOpacity: config.linkOpacity,
			showNodeLabels: config.showNodeLabels,
			sourceNodeColor: config.sourceNodeColor,
			targetNodeColor: config.targetNodeColor,
			edgeColorMode: config.edgeColorMode,
			zoomScale: config.zoomScale,
			alphaDecay: config.alphaDecay,
			showLegend: config.showLegend,
			locale: getLocale(),
			labels: {
				node: t('chive-chart-control-network-source'),
				linkWeight: t('chive-chart-control-network-weight'),
				source: config.source || t('chive-chart-control-network-source'),
				target: config.target || t('chive-chart-control-network-target'),
			},
			sourceColumn: config.source,
			targetColumn: config.target,
			filterCallbacks,
		}
	);

	if (!result.ok) {
		showChartMessage(CHART_CONTAINERS.network, t('chive-chart-empty-network'));
	}
}
