/**
 * Line-chart workspace section adapter. Owns the static block's visibility,
 * delegates rendering to the package presentation flow, and surfaces localized
 * empty-state messages when rendering fails.
 */

import { t } from '../../services/i18nService.js';
import { CHART_CONTAINERS, CHART_BLOCKS } from '../workspaceDomIds.js';
import { clearChartContainer, showChartMessage } from '../shared/containerLifecycle.js';
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
	const result = renderLineInto(container, rows, config, columnTypeByName, filterCallbacks);

	if (!result.ok) {
		const key = result.reason === 'no-numeric'
			? 'chive-chart-empty-line-numeric'
			: result.reason === 'no-x-values'
				? 'chive-chart-empty-line-x'
				: 'chive-chart-empty-line';
		showChartMessage(CHART_CONTAINERS.line, t(key));
	}
}
