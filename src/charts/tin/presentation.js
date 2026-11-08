/**
 * Shared TIN presentation flow.
 *
 * Workspace and Panel pass stored config unchanged to the same renderer,
 * alongside presentation-owned text and runtime context. This flow also shows
 * localized empty states on both surfaces.
 * Localized axis labels and the browser-local color
 * rendering preference stay here so the renderer remains stateless: it
 * receives `colorRenderingMode` explicitly instead of reading settings.
 */

import { t, getLocale } from '../../services/i18nService.js';
import { showChartMessage } from '../shared/containerLifecycle.js';
import { getTinColorRendering } from '../../services/settingsService.js';
import { renderTinChart } from './renderers/svg.js';

/**
 * Render a TIN surface from a live config block or captured panel snapshot.
 *
 * @param {HTMLElement} container
 * @param {import('../../types.js').ChartInput} input
 * @returns {import('../../types.js').Result}
 */
export function renderTinInto(container, { rows, config }) {
	const result = renderTinChart(container, rows, config, {
		colorRenderingMode: getTinColorRendering(),
		axisLabels: {
			x: config.x || t('chive-chart-control-tin-x'),
			y: config.y || t('chive-chart-control-tin-y'),
			z: config.z || t('chive-chart-control-tin-z'),
		},
		locale: getLocale(),
	});

	if (!result.ok) {
		const key = result.reason === 'insufficient-points'
			? 'chive-chart-empty-tin-insufficient-points'
			: 'chive-chart-empty-tin';
		showChartMessage(container, t(key));
	}
	return result;
}
