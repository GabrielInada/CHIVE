/**
 * Shared bubble-chart presentation flow.
 *
 * Workspace and panel integrations both map their config into the same SVG
 * renderer contract. This flow also shows localized empty states on both surfaces.
 * Localized labels stay here so the renderer remains
 * stateless and i18n-free.
 */

import { t, getLocale } from '../../services/i18nService.js';
import { showChartMessage } from '../shared/containerLifecycle.js';
import { measureLabelKey } from '../shared/measure.js';
import { renderBubbleChart } from './renderers/svg.js';

const EMPTY_FILTER_CALLBACKS = Object.freeze({});

/**
 * Render a bubble chart from a live config block or captured panel snapshot.
 *
 * @param {HTMLElement} container
 * @param {Array<Object<string, *>>} rows
 * @param {Object} [config]
 * @param {Object} [filterCallbacks]
 * @returns {import('../../types.js').Result}
 */
export function renderBubbleInto(
	container,
	rows,
	config = {},
	filterCallbacks = EMPTY_FILTER_CALLBACKS,
) {
	const result = renderBubbleChart(container, rows, config.category, {
		customTitle: config.customTitle,
		chartHeight: config.chartHeight,
		topN: config.topN,
		measureMode: config.measureMode,
		valueColumn: config.valueColumn,
		nestingColumns: config.nestingColumns,
		groupColumn: config.groupColumn,
		nestingMode: config.nestingMode,
		padding: config.padding,
		labelMode: config.labelMode,
		colorScheme: config.colorScheme,
		locale: getLocale(),
		labels: {
			close: t('chive-tooltip-close'),
			category: t('chive-chart-control-bubble-category'),
			measure: t(measureLabelKey(config.measureMode)),
			group: t('chive-chart-control-bubble-group'),
			children: t('chive-chart-control-bubble-node-children-count'),
			level: t('chive-chart-control-bubble-node-depth'),
			missing: t('chive-chart-filter-missing'),
		},
		filterCallbacks,
	});

	if (!result.ok) {
		const key = result.reason === 'no-value-column' || result.reason === 'no-numeric'
			? 'chive-chart-empty-bubble-numeric'
			: result.reason === 'no-positive-value'
				? 'chive-chart-empty-no-positive-sum'
				: result.reason === 'no-nesting-columns' || result.reason === 'no-group-column'
					? 'chive-chart-empty-bubble-nesting-required'
					: 'chive-chart-empty-bubble';
		showChartMessage(container, t(key));
	}
	return result;
}
