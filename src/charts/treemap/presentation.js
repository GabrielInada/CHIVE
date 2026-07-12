/**
 * Shared treemap presentation flow.
 *
 * Workspace and panel integrations both map their config into the same SVG
 * renderer contract. Localized labels stay here so the renderer remains
 * stateless and i18n-free.
 */

import { t, getLocale } from '../../services/i18nService.js';
import { renderTreeMap } from './renderers/svg.js';

const EMPTY_FILTER_CALLBACKS = Object.freeze({});

/**
 * Render a treemap from a live config block or frozen panel snapshot.
 *
 * @param {HTMLElement} container
 * @param {Array<Object<string, *>>} rows
 * @param {Object} [config]
 * @param {Object} [filterCallbacks]
 * @returns {import('../../types.js').Result}
 */
export function renderTreemapInto(
	container,
	rows,
	config = {},
	filterCallbacks = EMPTY_FILTER_CALLBACKS,
) {
	return renderTreeMap(container, rows, config.category, {
		customTitle: config.customTitle,
		chartHeight: config.chartHeight,
		measureMode: config.measureMode,
		valueColumn: config.valueColumn,
		topN: config.topN,
		padding: config.padding,
		showLabels: config.showLabels,
		showValues: config.showValues,
		color: config.color,
		colorMode: config.colorMode,
		colorScheme: config.colorScheme,
		locale: getLocale(),
		labels: {
			category: t('chive-chart-control-treemap-category'),
			count: t('chive-tooltip-count'),
			sum: t('chive-tooltip-sum'),
			percentage: t('chive-tooltip-percentage'),
			focusOnThis: t('chive-tooltip-show-only-this'),
			addToFilter: t('chive-tooltip-add-to-filter'),
		},
		filterCallbacks,
	});
}
