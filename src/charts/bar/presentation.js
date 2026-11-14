/**
 * Shared bar-chart presentation flow.
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
import { renderBarChart } from './renderers/svg.js';

const EMPTY_FILTER_CALLBACKS = Object.freeze({});

/**
 * Render a bar chart from a live config block or captured panel snapshot.
 *
 * @param {HTMLElement} container
 * @param {import('../../types.js').ChartInput} input
 * @returns {import('../../types.js').Result}
 */
export function renderBarInto(container, { rows, config, columnCurrencyByName = {}, filterCallbacks = EMPTY_FILTER_CALLBACKS }) {
	const measureLabel = t(measureLabelKey(config.measureMode));
	const result = renderBarChart(container, rows, config, {
		axisLabels: {
			x: config.category || t('chive-chart-control-bar-category'),
			y: measureLabel,
		},
		locale: getLocale(),
		currencies: getChartCurrencies(config, columnCurrencyByName),
		labels: {
			...tooltipLabels(t),
			category: t('chive-chart-control-bar-category'),
			measure: measureLabel,
			percentage: t('chive-tooltip-percentage'),
		},
		filterCallbacks,
	});

	if (!result.ok) {
		const key = result.reason === 'no-numeric' || result.reason === 'no-value-column'
			? 'chive-chart-empty-bar-numeric'
			: 'chive-chart-empty-bar';
		showChartMessage(container, t(key));
	}
	return result;
}
