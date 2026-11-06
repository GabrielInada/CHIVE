/**
 * Treemap-chart workspace section adapter. Owns block visibility and
 * minimum height; the presentation flow draws the chart or its empty state.
 */

import { CHART_CONTAINERS, CHART_BLOCKS } from '../workspaceDomIds.js';
import { clearChartContainer } from '../shared/containerLifecycle.js';
import { renderTreemapInto } from './presentation.js';

/**
 * Render the treemap section for the current dataset.
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
		block.hidden = true;
		clearChartContainer(container);
		return;
	}
	block.hidden = false;
	container.style.minHeight = `${Number(config.chartHeight || 380)}px`;
	renderTreemapInto(container, rows, config, filterCallbacks);
}
