/**
 * Bubble-chart workspace section adapter. Owns block visibility and
 * minimum height; the presentation flow draws the chart or its empty state.
 */

import { CHART_CONTAINERS, CHART_BLOCKS } from '../workspaceDomIds.js';
import { clearChartContainer } from '../shared/containerLifecycle.js';
import { renderBubbleInto } from './presentation.js';

/**
 * Render the bubble-chart section.
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
		block.hidden = true;
		clearChartContainer(container);
		return;
	}
	block.hidden = false;
	container.style.minHeight = `${Number(config.chartHeight || 700)}px`;
	renderBubbleInto(container, rows, config, filterCallbacks);
}
