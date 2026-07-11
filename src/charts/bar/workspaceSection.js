/**
 * Bar-chart workspace section adapter. Owns the static block's visibility,
 * delegates rendering to the package presentation flow, and surfaces a
 * localized empty-state message when rendering fails.
 */

import { t } from '../../services/i18nService.js';
import { CHART_CONTAINERS, CHART_BLOCKS } from '../../config/elementIds.js';
import { clearChartContainer, showChartMessage } from '../../utils/chartContainerLifecycle.js';
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
		if (block) block.style.display = 'none';
		clearChartContainer(container);
		return;
	}
	if (block) block.style.display = 'block';
	if (!container) return;
	container.style.minHeight = `${Number(config.chartHeight || 320)}px`;
	const result = renderBarInto(container, rows, config, filterCallbacks);
	if (!result.ok) {
		const key = result.reason === 'no-numeric' || result.reason === 'no-value-column'
			? 'chive-chart-empty-bar-numeric'
			: 'chive-chart-empty-bar';
		showChartMessage(CHART_CONTAINERS.bar, t(key));
	}
}
