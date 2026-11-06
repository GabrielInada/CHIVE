/**
 * Scatter-chart workspace section adapter. Owns block visibility and
 * minimum height; the presentation flow draws the chart or its empty state.
 */

import { CHART_CONTAINERS, CHART_BLOCKS } from '../workspaceDomIds.js';
import { clearChartContainer } from '../shared/containerLifecycle.js';
import { renderScatterInto } from './presentation.js';

/**
 * Render the scatter-plot section. Surfaces `'log-no-positive'` as a
 * distinct empty message.
 *
 * @param {Object} args
 * @param {Object} args.config
 * @param {Array<Object<string, *>>} args.rows
 * @param {Object<string, string>} args.columnTypeByName - Column name → `ColumnType`.
 * @param {Object} args.filterCallbacks
 * @returns {void}
 */
export function renderScatterChartSection({ config, rows, columnTypeByName, filterCallbacks }) {
	const block = document.getElementById(CHART_BLOCKS.scatter);
	const container = document.getElementById(CHART_CONTAINERS.scatter);
	if (!config.enabled) {
		block.hidden = true;
		clearChartContainer(container);
		return;
	}
	block.hidden = false;
	container.style.minHeight = `${Number(config.chartHeight || 320)}px`;
	renderScatterInto(container, rows, config, columnTypeByName, filterCallbacks);
}
