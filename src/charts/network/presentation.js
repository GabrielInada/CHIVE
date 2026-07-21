/**
 * Shared network-graph presentation flow.
 *
 * Workspace and panel integrations both map their config into the same SVG
 * renderer contract. Localized labels stay here so the renderer remains
 * stateless and i18n-free. The source/target column names double as the
 * click-to-filter columns for node tooltips.
 */

import { t, getLocale } from '../../services/i18nService.js';
import { ok } from '../../utils/result.js';
import { NETWORK_GRAPH } from '../../config/charts/definitions/network.js';
import {
	appendRenderBudgetNotice,
	approveFullRender,
	hasFullRenderApproval,
} from '../shared/renderBudget.js';
import { renderNetworkGraph } from './renderers/svg.js';

const EMPTY_FILTER_CALLBACKS = Object.freeze({});

/**
 * Render a network graph from a live config block or captured panel snapshot.
 *
 * @param {HTMLElement} container
 * @param {Array<Object<string, *>>} rows
 * @param {Object} [config]
 * @param {Object} [filterCallbacks]
 * @returns {import('../../types.js').Result}
 */
export function renderNetworkInto(container, rows, config = {}, filterCallbacks = EMPTY_FILTER_CALLBACKS) {
	container.querySelector('.chart-render-budget-notice')?.remove();
	const result = renderNetworkGraph(container, rows, config.source, config.target, {
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
		allowFullRender: hasFullRenderApproval(container, 'network'),
	});

	if (!result.ok && result.reason === 'render-budget-exceeded') {
		appendRenderBudgetNotice(container, {
			message: t(
				'chive-chart-network-budget-notice',
				String(result.nodesCount),
				String(result.linksCount),
				String(NETWORK_GRAPH.maxNodes),
				String(NETWORK_GRAPH.maxLinks),
			),
			actionLabel: t('chive-chart-render-full'),
			blocked: true,
			onApprove: () => {
				approveFullRender(container, 'network');
				renderNetworkInto(container, rows, config, filterCallbacks);
			},
		});
		return ok({
			budgetExceeded: true,
			nodesCount: result.nodesCount,
			linksCount: result.linksCount,
		});
	}

	return result;
}
