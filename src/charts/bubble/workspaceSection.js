/**
 * Bubble-chart workspace section adapter. Owns the static block's visibility,
 * delegates rendering to the package presentation flow, and surfaces localized
 * empty-state messages when rendering fails.
 */

import { t } from '../../services/i18nService.js';
import { CHART_CONTAINERS, CHART_BLOCKS } from '../../config/elementIds.js';
import { clearChartContainer, showChartMessage } from '../../utils/chartContainerLifecycle.js';
import { renderBubbleInto } from './presentation.js';

/**
 * Render the bubble-chart section. Surfaces `'no-value-column'`,
 * `'no-numeric'`, `'no-nesting-columns'`, and `'no-group-column'` as
 * distinct empty messages.
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
		block.style.display = 'none';
		clearChartContainer(container);
		return;
	}
	block.style.display = 'block';
	container.style.minHeight = `${Number(config.chartHeight || 700)}px`;
	const result = renderBubbleInto(container, rows, config, filterCallbacks);

	if (!result.ok) {
		const key = result.reason === 'no-value-column' || result.reason === 'no-numeric'
			? 'chive-chart-empty-bubble-numeric'
			: result.reason === 'no-nesting-columns' || result.reason === 'no-group-column'
				? 'chive-chart-empty-bubble-nesting-required'
				: 'chive-chart-empty-bubble';
		showChartMessage(CHART_CONTAINERS.bubble, t(key));
	}
}
