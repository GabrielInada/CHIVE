/**
 * TIN-chart workspace section adapter. Owns the static block's visibility,
 * delegates rendering to the package presentation flow, and surfaces localized
 * empty-state messages. TIN does not currently expose filter actions.
 */

import { t } from '../../services/i18nService.js';
import { CHART_CONTAINERS, CHART_BLOCKS } from '../../config/elementIds.js';
import { clearChartContainer, showChartMessage } from '../../utils/chartContainerLifecycle.js';
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
		if (block) block.style.display = 'none';
		clearChartContainer(container);
		return;
	}
	if (block) block.style.display = 'block';
	if (!container) return;
	container.style.minHeight = `${Number(config.chartHeight || 460)}px`;
	const result = renderTinInto(container, rows, config);
	if (!result.ok) {
		const key = result.reason === 'insufficient-points'
			? 'chive-chart-empty-tin-insufficient-points'
			: 'chive-chart-empty-tin';
		showChartMessage(CHART_CONTAINERS.tin, t(key));
	}
}
