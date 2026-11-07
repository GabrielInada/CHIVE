/**
 * Shared TIN presentation flow.
 *
 * Workspace and panel integrations both map their config into the same SVG
 * renderer contract. This flow also shows localized empty states on both surfaces.
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
	const result = renderTinChart(container, rows, config.x, config.y, config.z, {
		customTitle: config.customTitle,
		chartHeight: config.chartHeight,
		fillMode: config.fillMode,
		colorRenderingMode: getTinColorRendering(),
		subdivisionDepth: config.subdivisionDepth,
		colorRamp: config.colorRamp,
		gradientMinColor: config.gradientMinColor,
		gradientMaxColor: config.gradientMaxColor,
		gradientDistribution: config.gradientDistribution,
		showEdges: config.showEdges,
		edgeColor: config.edgeColor,
		showPoints: config.showPoints,
		pointRadius: config.pointRadius,
		showZLabels: config.showZLabels,
		showHull: config.showHull,
		hullColor: config.hullColor,
		showIsolines: config.showIsolines,
		isolineMode: config.isolineMode,
		isolineCount: config.isolineCount,
		isolineStep: config.isolineStep,
		isolineColor: config.isolineColor,
		isolineWidth: config.isolineWidth,
		colorIsolinesByZ: config.colorIsolinesByZ,
		isolineMinColor: config.isolineMinColor,
		isolineMaxColor: config.isolineMaxColor,
		showIsolineLabels: config.showIsolineLabels,
		isolineLabelSize: config.isolineLabelSize,
		isolineLabelColor: config.isolineLabelColor,
		showThreshold: config.showThreshold,
		thresholdValue: config.thresholdValue,
		thresholdColor: config.thresholdColor,
		thresholdWidth: config.thresholdWidth,
		showXAxisLabel: config.showXAxisLabel,
		showYAxisLabel: config.showYAxisLabel,
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
