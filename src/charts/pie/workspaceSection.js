/**
 * Pie-chart workspace section adapter. Owns the static block's visibility,
 * delegates rendering to the package presentation flow, and surfaces a
 * localized empty-state message when rendering fails.
 */

import { t } from '../../services/i18nService.js';
import { CHART_CONTAINERS, CHART_BLOCKS } from '../../config/elementIds.js';
import { clearChartContainer, showChartMessage } from '../../utils/chartContainerLifecycle.js';
import { renderPieInto } from './presentation.js';

/**
 * Render the pie-chart section.
 *
 * @param {Object} args
 * @param {Object} args.config
 * @param {Array<Object<string, *>>} args.rows
 * @param {Object} args.filterCallbacks
 * @returns {void}
 */
export function renderPieChartSection({ config, rows, filterCallbacks }) {
	const block = document.getElementById(CHART_BLOCKS.pie);
	const container = document.getElementById(CHART_CONTAINERS.pie);
	if (!config.enabled) {
		block.style.display = 'none';
		clearChartContainer(container);
		return;
	}
	block.style.display = 'block';
	container.style.minHeight = `${Number(config.chartHeight || 360)}px`;
	const result = renderPieInto(container, rows, config, filterCallbacks);

	if (!result.ok) {
		const key = result.reason === 'sum-no-numeric'
			? 'chive-chart-empty-pie-sum'
			: 'chive-chart-empty-pie';
		showChartMessage(CHART_CONTAINERS.pie, t(key));
	}
}
