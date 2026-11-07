/**
 * Network-chart workspace section adapter. Owns block visibility and
 * minimum height; the presentation flow draws the chart or its empty state.
 */

import { CHART_CONTAINERS, CHART_BLOCKS } from '../workspaceDomIds.js';
import { clearChartContainer } from '../shared/containerLifecycle.js';
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
		block.hidden = true;
		clearChartContainer(container);
		return;
	}
	block.hidden = false;
	container.style.minHeight = `${Number(config.chartHeight || 420)}px`;
	renderNetworkInto(container, rows, config, filterCallbacks);
}
