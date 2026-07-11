/**
 * Panel chart integration registry.
 *
 * Package adapters and temporary legacy adapters are normalized to the shared
 * `(container, snapshot) => Result` contract here. This registry owns panel
 * rendering only; it does not import controls, workspace components, or state.
 *
 * Panel snapshots are frozen. Legacy adapters therefore pass an empty filter
 * callback bag so panel tooltips cannot mutate the live dataset.
 *
 * @typedef {import('../../types.js').ChartSnapshot} ChartSnapshot
 * @typedef {import('../../types.js').Result} Result
 * @typedef {import('../../types.js').ChartTypeKey} ChartTypeKey
 * @typedef {import('../../types.js').ColumnSpec} ColumnSpec
 * @typedef {import('../../types.js').ColumnType} ColumnType
 * @typedef {(container: HTMLElement, spec: ChartSnapshot) => Result} PanelChartRenderer
 */

import { CHART_TYPE_KEYS } from '../../config/chartTypes.js';
import { t, getLocale } from '../../services/i18nService.js';
import { renderBarPanelChart } from '../bar/panelAdapter.js';
import { renderBubblePanelChart } from '../bubble/panelAdapter.js';
import { renderPiePanelChart } from '../pie/panelAdapter.js';
import { renderScatter3dPanelChart } from '../scatter3d/panelAdapter.js';
import { renderTreemapPanelChart } from '../treemap/panelAdapter.js';
import { renderLineChart } from '../../modules/visualizations/lineChart.js';
import { renderNetworkGraph } from '../../modules/visualizations/networkGraph.js';
import { renderScatterPlot } from '../../modules/visualizations/scatterPlot.js';
import { renderTinChart } from '../../modules/visualizations/tinChart.js';

const EMPTY_FILTER_CALLBACKS = Object.freeze({});

/**
 * Build a column-type lookup from a panel snapshot.
 *
 * @param {ColumnSpec[] | null | undefined} columnsSnapshot
 * @returns {Object<string, ColumnType>}
 */
function buildColumnTypeIndex(columnsSnapshot) {
	if (!Array.isArray(columnsSnapshot)) return {};
	const index = {};
	for (const column of columnsSnapshot) {
		if (column?.name) index[column.name] = column.type;
	}
	return index;
}

/**
 * Build options shared by legacy panel renderers. `filterCallbacks` remains
 * explicit per adapter because TIN does not accept it.
 *
 * @param {Object} config
 * @returns {{ customTitle: *, chartHeight: *, locale: string }}
 */
function baseOptions(config) {
	return {
		customTitle: config.customTitle,
		chartHeight: config.chartHeight,
		locale: getLocale(),
	};
}

/** @type {PanelChartRenderer} */
function renderScatter(container, spec) {
	const config = spec.config || {};
	const columnTypeByName = buildColumnTypeIndex(spec.columnsSnapshot);
	return renderScatterPlot(container, spec.dataSnapshot, config.x, config.y, {
		...baseOptions(config),
		xScale: config.xScale,
		yScale: config.yScale,
		radius: config.radius,
		opacity: config.opacity,
		sizeMode: config.sizeMode,
		sizeField: config.sizeField,
		sizeMin: config.sizeMin,
		sizeMax: config.sizeMax,
		color: config.color,
		colorMode: config.colorMode,
		colorField: config.colorField,
		gradientMinColor: config.gradientMinColor,
		gradientMaxColor: config.gradientMaxColor,
		gradientDistribution: config.gradientDistribution,
		colorScheme: config.colorScheme,
		categoricalPairMode: config.categoricalPairMode,
		showXAxisLabel: config.showXAxisLabel,
		showYAxisLabel: config.showYAxisLabel,
		regression: config.regression,
		axisLabels: {
			x: config.x || t('chive-chart-control-scatter-x'),
			y: config.y || t('chive-chart-control-scatter-y'),
		},
		axisTypes: {
			x: columnTypeByName[config.x],
			y: columnTypeByName[config.y],
		},
		labels: {
			xAxis: t('chive-chart-control-scatter-x'),
			yAxis: t('chive-chart-control-scatter-y'),
			index: t('chive-tooltip-row'),
			count: t('chive-tooltip-count'),
			regressionSlope: t('chive-chart-tooltip-regression-slope'),
			regressionIntercept: t('chive-chart-tooltip-regression-intercept'),
			regressionR2: t('chive-chart-tooltip-regression-r2'),
			regressionN: t('chive-chart-tooltip-regression-n'),
			regressionGroup: t('chive-chart-tooltip-regression-group'),
		},
		xColumn: config.x,
		yColumn: config.y,
		filterCallbacks: EMPTY_FILTER_CALLBACKS,
	});
}

/** @type {PanelChartRenderer} */
function renderNetwork(container, spec) {
	const config = spec.config || {};
	return renderNetworkGraph(container, spec.dataSnapshot, config.source, config.target, {
		...baseOptions(config),
		weightColumn: config.weight,
		groupColumn: config.group,
		nodeRadius: config.nodeRadius,
		linkDistance: config.linkDistance,
		chargeStrength: config.chargeStrength,
		linkOpacity: config.linkOpacity,
		showNodeLabels: config.showNodeLabels,
		sourceNodeColor: config.sourceNodeColor,
		targetNodeColor: config.targetNodeColor,
		edgeColorMode: config.edgeColorMode,
		zoomScale: config.zoomScale,
		alphaDecay: config.alphaDecay,
		showLegend: config.showLegend,
		labels: {
			node: t('chive-chart-control-network-source'),
			linkWeight: t('chive-chart-control-network-weight'),
			source: config.source || t('chive-chart-control-network-source'),
			target: config.target || t('chive-chart-control-network-target'),
		},
		sourceColumn: config.source,
		targetColumn: config.target,
		filterCallbacks: EMPTY_FILTER_CALLBACKS,
	});
}

/** @type {PanelChartRenderer} */
function renderLine(container, spec) {
	const config = spec.config || {};
	const columnTypeByName = buildColumnTypeIndex(spec.columnsSnapshot);
	return renderLineChart(container, spec.dataSnapshot, config.x, config.y, {
		...baseOptions(config),
		curve: config.curve,
		missingMode: config.missingMode,
		strokeWidth: config.strokeWidth,
		color: config.color,
		ghostStrokeColor: config.ghostStrokeColor,
		showPoints: config.showPoints,
		sortX: config.sortX,
		aggregateMode: config.aggregateMode,
		showXAxisLabel: config.showXAxisLabel,
		showYAxisLabel: config.showYAxisLabel,
		axisLabels: {
			x: config.x || t('chive-chart-control-line-x'),
			y: config.y || t('chive-chart-control-line-y'),
		},
		axisTypes: {
			x: columnTypeByName[config.x],
			y: columnTypeByName[config.y],
		},
		filterCallbacks: EMPTY_FILTER_CALLBACKS,
	});
}

/** @type {PanelChartRenderer} */
function renderTin(container, spec) {
	const config = spec.config || {};
	return renderTinChart(container, spec.dataSnapshot, config.x, config.y, config.z, {
		...baseOptions(config),
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
	line: renderLine,
	scatter: renderScatter,
	scatter3d: renderScatter3dPanelChart,
	pie: renderPiePanelChart,
	bubble: renderBubblePanelChart,
	network: renderNetwork,
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
