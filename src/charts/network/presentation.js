/**
 * Shared network-graph presentation flow.
 *
 * Workspace and Panel pass stored config unchanged to the same renderer,
 * alongside presentation-owned text and runtime context. This flow also shows
 * localized empty states on both surfaces.
 * Localized labels stay here so the renderer remains
 * stateless and i18n-free. The source/target column names double as the
 * click-to-filter columns for node tooltips.
 */

import { getChartCurrencies } from '../shared/currency.js';
import { t, getLocale } from '../../services/i18nService.js';
import { tooltipLabels } from '../shared/tooltip/labels.js';
import { showChartMessage } from '../shared/containerLifecycle.js';
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
 * @param {import('../../types.js').ChartInput} input
 * @returns {import('../../types.js').Result}
 */
export function renderNetworkInto(container, input) {
	const { rows, config, columnCurrencyByName = {}, filterCallbacks = EMPTY_FILTER_CALLBACKS } = input;
	container.querySelector('.chart-render-budget-notice')?.remove();
	const result = renderNetworkGraph(container, rows, config, {
		locale: getLocale(),
		currencies: getChartCurrencies(config, columnCurrencyByName),
		labels: {
			...tooltipLabels(t),
			node: t('chive-chart-control-network-source'),
			linkWeight: t('chive-chart-control-network-weight'),
			source: config.source || t('chive-chart-control-network-source'),
			target: config.target || t('chive-chart-control-network-target'),
		},
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
				renderNetworkInto(container, input);
			},
		});
		return ok({
			budgetExceeded: true,
			nodesCount: result.nodesCount,
			linksCount: result.linksCount,
		});
	}

	if (!result.ok) {
		showChartMessage(container, t('chive-chart-empty-network'));
	}
	return result;
}
