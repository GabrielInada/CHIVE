/**
 * Treemap workspace section adapter. Owns the static block's visibility,
 * delegates rendering to the package presentation flow, and surfaces a
 * localized empty-state message when rendering fails.
 */

import { t } from '../../services/i18nService.js';
import { CHART_CONTAINERS, CHART_BLOCKS } from '../workspaceDomIds.js';
import { clearChartContainer, showChartMessage } from '../../utils/chartContainerLifecycle.js';
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
		block.style.display = 'none';
		clearChartContainer(container);
		return;
	}
	block.style.display = 'block';
	container.style.minHeight = `${Number(config.chartHeight || 380)}px`;
	const result = renderTreemapInto(container, rows, config, filterCallbacks);

	if (!result.ok) {
		const key = result.reason === 'no-value-column'
			? 'chive-chart-empty-treemap-numeric'
			: 'chive-chart-empty-treemap';
		showChartMessage(CHART_CONTAINERS.treemap, t(key));
	}
}
