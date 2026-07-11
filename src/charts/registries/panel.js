/**
 * Panel chart integration registry.
 *
 * Package adapters and temporary legacy adapters are normalized to the shared
 * `(container, snapshot) => Result` contract here. This registry owns panel
 * rendering only; it does not import controls, workspace components, or state.
 *
 * Panel snapshots are frozen. TIN, the one remaining legacy adapter, accepts
 * no filter callbacks, so panel tooltips cannot mutate the live dataset.
 *
 * @typedef {import('../../types.js').ChartSnapshot} ChartSnapshot
 * @typedef {import('../../types.js').Result} Result
 * @typedef {import('../../types.js').ChartTypeKey} ChartTypeKey
 * @typedef {(container: HTMLElement, spec: ChartSnapshot) => Result} PanelChartRenderer
 */

import { CHART_TYPE_KEYS } from '../../config/chartTypes.js';
import { t, getLocale } from '../../services/i18nService.js';
import { renderBarPanelChart } from '../bar/panelAdapter.js';
import { renderBubblePanelChart } from '../bubble/panelAdapter.js';
import { renderLinePanelChart } from '../line/panelAdapter.js';
import { renderNetworkPanelChart } from '../network/panelAdapter.js';
import { renderPiePanelChart } from '../pie/panelAdapter.js';
import { renderScatterPanelChart } from '../scatter/panelAdapter.js';
import { renderScatter3dPanelChart } from '../scatter3d/panelAdapter.js';
import { renderTreemapPanelChart } from '../treemap/panelAdapter.js';
import { renderTinChart } from '../../modules/visualizations/tinChart.js';

/** @type {PanelChartRenderer} */
function renderTin(container, spec) {
	const config = spec.config || {};
	return renderTinChart(container, spec.dataSnapshot, config.x, config.y, config.z, {
		customTitle: config.customTitle,
		chartHeight: config.chartHeight,
		locale: getLocale(),
		fillMode: config.fillMode,
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
	});
}

/** @type {Readonly<Object<ChartTypeKey, PanelChartRenderer>>} */
const PANEL_RENDERERS = Object.freeze({
	bar: renderBarPanelChart,
	line: renderLinePanelChart,
	scatter: renderScatterPanelChart,
	scatter3d: renderScatter3dPanelChart,
	pie: renderPiePanelChart,
	bubble: renderBubblePanelChart,
	network: renderNetworkPanelChart,
	treemap: renderTreemapPanelChart,
	tin: renderTin,
});

/**
 * Chart types with panel renderers, in canonical chart order.
 *
 * @type {ReadonlyArray<ChartTypeKey>}
 */
export const SUPPORTED_PANEL_CHART_TYPES = Object.freeze(
	CHART_TYPE_KEYS.filter(type => Object.hasOwn(PANEL_RENDERERS, type)),
);

/**
 * Resolve a panel renderer for a chart snapshot. Unknown keys return `null`.
 *
 * @param {string} chartType
 * @returns {PanelChartRenderer | null}
 */
export function getPanelChartRenderer(chartType) {
	return Object.hasOwn(PANEL_RENDERERS, chartType)
		? PANEL_RENDERERS[chartType]
		: null;
}
