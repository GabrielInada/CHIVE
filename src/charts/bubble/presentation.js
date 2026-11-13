/**
 * Shared bubble-chart presentation flow.
 *
 * Workspace and Panel pass stored config unchanged to the same renderer,
 * alongside presentation-owned text and runtime context. This flow also shows
 * localized empty states on both surfaces.
 * Localized labels stay here so the renderer remains
 * stateless and i18n-free.
 */

import { getChartCurrencies } from '../shared/currency.js';
import { t, getLocale } from '../../services/i18nService.js';
import { tooltipLabels } from '../shared/tooltip/labels.js';
import { showChartMessage } from '../shared/containerLifecycle.js';
import { measureLabelKey } from '../shared/measure.js';
import { renderBubbleChart } from './renderers/svg.js';

const EMPTY_FILTER_CALLBACKS = Object.freeze({});

/**
 * Render a bubble chart from a live config block or captured panel snapshot.
 *
 * @param {HTMLElement} container
 * @param {import('../../types.js').ChartInput} input
 * @returns {import('../../types.js').Result}
 */
export function renderBubbleInto(container, { rows, config, columnCurrencyByName = {}, filterCallbacks = EMPTY_FILTER_CALLBACKS }) {
	const result = renderBubbleChart(container, rows, config, {
		locale: getLocale(),
		currencies: getChartCurrencies(config, columnCurrencyByName),
		labels: {
			...tooltipLabels(t),
			category: t('chive-chart-control-bubble-category'),
			measure: t(measureLabelKey(config.measureMode)),
			group: t('chive-chart-control-bubble-group'),
			children: t('chive-chart-control-bubble-node-children-count'),
			level: t('chive-chart-control-bubble-node-depth'),
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
