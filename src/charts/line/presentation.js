/**
 * Shared line-chart presentation flow.
 *
 * Workspace and Panel pass stored config unchanged to the same renderer,
 * alongside presentation-owned text and runtime context. This flow also shows
 * localized empty states on both surfaces.
 * Localized labels stay here so the renderer remains
 * stateless and i18n-free. The x-axis column type is forwarded so the
 * renderer can decide between numeric, point, and time scales.
 */

import { t, getLocale } from '../../services/i18nService.js';
import { showChartMessage } from '../shared/containerLifecycle.js';
import { renderLineChart } from './renderers/svg.js';

const EMPTY_FILTER_CALLBACKS = Object.freeze({});

/**
 * Render a line chart from a live config block or captured panel snapshot.
 *
 * @param {HTMLElement} container
 * @param {import('../../types.js').ChartInput} input
 * @returns {import('../../types.js').Result}
 */
export function renderLineInto(container, { rows, config, columnTypeByName = {}, filterCallbacks = EMPTY_FILTER_CALLBACKS }) {
	const result = renderLineChart(container, rows, config, {
		axisLabels: {
			x: config.x || t('chive-chart-control-line-x'),
			y: config.y || t('chive-chart-control-line-y'),
		},
		axisTypes: {
			x: columnTypeByName[config.x],
			y: columnTypeByName[config.y],
		},
		locale: getLocale(),
		filterCallbacks,
	});

	if (!result.ok) {
		const key = result.reason === 'no-numeric'
			? 'chive-chart-empty-line-numeric'
			: result.reason === 'no-x-values'
				? 'chive-chart-empty-line-x'
				: 'chive-chart-empty-line';
		showChartMessage(container, t(key));
	}
	return result;
}
