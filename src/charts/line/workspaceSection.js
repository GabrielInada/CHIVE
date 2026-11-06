/**
 * Line-chart workspace section adapter. Owns block visibility and
 * minimum height; the presentation flow draws the chart or its empty state.
 */

import { CHART_CONTAINERS, CHART_BLOCKS } from '../workspaceDomIds.js';
import { clearChartContainer } from '../shared/containerLifecycle.js';
import { renderLineInto } from './presentation.js';

/**
 * Render the line-chart section. Surfaces `'no-numeric'` and `'no-x-values'`
 * as distinct empty messages.
 *
 * @param {Object} args
 * @param {Object} args.config
 * @param {Array<Object<string, *>>} args.rows
 * @param {Object<string, string>} args.columnTypeByName - Column name → `ColumnType`.
 * @param {Object} args.filterCallbacks
 * @returns {void}
 */
export function renderLineChartSection({ config, rows, columnTypeByName, filterCallbacks }) {
	const block = document.getElementById(CHART_BLOCKS.line);
	const container = document.getElementById(CHART_CONTAINERS.line);
	if (!config.enabled) {
		block.hidden = true;
		clearChartContainer(container);
		return;
	}
	block.hidden = false;
	container.style.minHeight = `${Number(config.chartHeight || 320)}px`;
	renderLineInto(container, rows, config, columnTypeByName, filterCallbacks);
}
