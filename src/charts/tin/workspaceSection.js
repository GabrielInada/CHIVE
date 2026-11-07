/**
 * Tin-chart workspace section adapter. Owns block visibility and
 * minimum height; the presentation flow draws the chart or its empty state.
 */

import { CHART_CONTAINERS, CHART_BLOCKS } from '../workspaceDomIds.js';
import { clearChartContainer } from '../shared/containerLifecycle.js';
import { renderTinInto } from './presentation.js';

/**
 * Render the TIN-chart section.
 *
 * @param {Object} args
 * @param {Object} args.config
 * @param {Array<Object<string, *>>} args.rows
 * @returns {void}
 */
export function renderTinChartSection({ config, rows }) {
	const block = document.getElementById(CHART_BLOCKS.tin);
	const container = document.getElementById(CHART_CONTAINERS.tin);
	if (!config || !config.enabled) {
		if (block) block.hidden = true;
		clearChartContainer(container);
		return;
	}
	if (block) block.hidden = false;
	if (!container) return;
	container.style.minHeight = `${Number(config.chartHeight || 460)}px`;
	renderTinInto(container, rows, config);
}
