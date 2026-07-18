/**
 * Scatter-plot workspace section adapter. Owns the static block's visibility,
 * delegates rendering to the package presentation flow, and surfaces localized
 * empty-state messages when rendering fails.
 */

import { t } from '../../services/i18nService.js';
import { CHART_CONTAINERS, CHART_BLOCKS } from '../workspaceDomIds.js';
import { clearChartContainer, showChartMessage } from '../shared/containerLifecycle.js';
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
		block.style.display = 'none';
		clearChartContainer(container);
		return;
	}
	block.style.display = 'block';
	container.style.minHeight = `${Number(config.chartHeight || 320)}px`;
	const result = renderScatterInto(container, rows, config, columnTypeByName, filterCallbacks);

	if (!result.ok) {
		const key = result.reason === 'log-no-positive'
			? 'chive-chart-empty-scatter-log'
			: 'chive-chart-empty-scatter';
		showChartMessage(CHART_CONTAINERS.scatter, t(key));
	}
}
