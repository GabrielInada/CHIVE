/**
 * Bar-chart workspace section adapter. Owns block visibility and
 * minimum height; the presentation flow draws the chart or its empty state.
 */

import { CHART_CONTAINERS, CHART_BLOCKS } from '../workspaceDomIds.js';
import { clearChartContainer } from '../shared/containerLifecycle.js';
import { renderBarInto } from './presentation.js';

/**
 * Render the bar-chart section for the current dataset.
 *
 * @param {Object} args
 * @param {Object} args.config - The bar config block (`chartConfig.bar`).
 * @param {Array<Object<string, *>>} args.rows - Already filtered by the global filter.
 * @param {Object} args.filterCallbacks - Bag of tooltip filter action handlers.
 * @returns {void}
 */
export function renderBarChartSection({ config, rows, filterCallbacks }) {
	const block = document.getElementById(CHART_BLOCKS.bar);
	const container = document.getElementById(CHART_CONTAINERS.bar);
	if (!config || !config.enabled) {
		if (block) block.hidden = true;
		clearChartContainer(container);
		return;
	}
	if (block) block.hidden = false;
	if (!container) return;
	container.style.minHeight = `${Number(config.chartHeight || 320)}px`;
	renderBarInto(container, rows, config, filterCallbacks);
}
