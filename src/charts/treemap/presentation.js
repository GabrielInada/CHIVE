/**
 * Shared treemap presentation flow.
 *
 * Workspace and Panel pass stored config unchanged to the same renderer,
 * alongside presentation-owned text and runtime context. This flow also shows
 * localized empty states on both surfaces.
 * Localized labels stay here so the renderer remains
 * stateless and i18n-free.
 */

import { t, getLocale } from '../../services/i18nService.js';
import { tooltipLabels } from '../shared/tooltip/labels.js';
import { showChartMessage } from '../shared/containerLifecycle.js';
import { measureLabelKey } from '../shared/measure.js';
import { renderTreemap } from './renderers/svg.js';

const EMPTY_FILTER_CALLBACKS = Object.freeze({});

/**
 * Render a treemap from a live config block or captured panel snapshot.
 *
 * @param {HTMLElement} container
 * @param {import('../../types.js').ChartInput} input
 * @returns {import('../../types.js').Result}
 */
export function renderTreemapInto(container, { rows, config, filterCallbacks = EMPTY_FILTER_CALLBACKS }) {
	const result = renderTreemap(container, rows, config, {
		locale: getLocale(),
		labels: {
			...tooltipLabels(t),
			category: t('chive-chart-control-treemap-category'),
			measure: t(measureLabelKey(config.measureMode)),
			percentage: t('chive-tooltip-percentage'),
		},
		filterCallbacks,
	});

	if (!result.ok) {
		const key = result.reason === 'no-numeric' || result.reason === 'no-value-column'
			? 'chive-chart-empty-treemap-numeric'
			: result.reason === 'no-positive-value'
				? 'chive-chart-empty-no-positive-sum'
				: 'chive-chart-empty-treemap';
		showChartMessage(container, t(key));
	}
	return result;
}
