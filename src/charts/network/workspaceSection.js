/**
 * Network-graph workspace section adapter. Owns the static block's visibility,
 * delegates rendering to the package presentation flow, and surfaces the
 * localized empty-state message when rendering fails.
 */

import { t } from '../../services/i18nService.js';
import { CHART_CONTAINERS, CHART_BLOCKS } from '../workspaceDomIds.js';
import { clearChartContainer, showChartMessage } from '../shared/containerLifecycle.js';
import { renderNetworkInto } from './presentation.js';

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
	const result = renderNetworkInto(container, rows, config, filterCallbacks);

	if (!result.ok) {
		showChartMessage(CHART_CONTAINERS.network, t('chive-chart-empty-network'));
	}
}
