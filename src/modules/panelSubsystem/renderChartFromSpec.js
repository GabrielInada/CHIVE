/**
 * CHIVE panel chart-rendering bridge.
 *
 * The single path through which panel slots render. `panelRenderer.js`
 * delegates here via {@link renderChartFromSpec} when mounting a slot;
 * this module then dispatches to the chart's renderer, either a legacy SVG
 * `render*Chart` function in `modules/visualizations/` or a per-chart package
 * adapter under `charts/` (bar and scatter3d).
 * Panel snapshots come into this module as
 * `{ type, config, dataSnapshot, columnsSnapshot, metadata }`, see
 * {@link ChartSnapshot} for the full shape.
 *
 * Panel-rendered charts intentionally pass an empty filter-callbacks bag
 * so tooltips do not surface filter actions: tooltip-driven filter writes
 * would mutate the live dataset, but the snapshot is frozen.
 *
 * @typedef {import('../../types.js').ChartSnapshot} ChartSnapshot
 * @typedef {import('../../types.js').Result} Result
 * @typedef {import('../../types.js').ChartTypeKey} ChartTypeKey
 * @typedef {import('../../types.js').ColumnSpec} ColumnSpec
 * @typedef {import('../../types.js').ColumnType} ColumnType
 */

import { t, getLocale } from '../../services/i18nService.js';
import { renderBarPanelChart } from '../../charts/bar/panelAdapter.js';
import { renderBubbleChart } from '../visualizations/bubbleChart.js';
import { renderLineChart } from '../visualizations/lineChart.js';
import { renderNetworkGraph } from '../visualizations/networkGraph.js';
import { renderPieChart } from '../visualizations/pieChart.js';
import { renderScatterPlot } from '../visualizations/scatterPlot.js';
import { renderTinChart } from '../visualizations/tinChart.js';
import { renderTreeMap } from '../visualizations/treemapChart.js';
import { renderScatter3dPanelChart } from '../../charts/scatter3d/panelAdapter.js';
import { fail } from '../../utils/result.js';

const EMPTY_FILTER_CALLBACKS = Object.freeze({});

/**
 * Build a `Record<columnName, ColumnType>` lookup from a snapshot's
 * columns array. Used by scatter/line/TIN to know which axes are
 * categorical vs numeric without scanning the rows.
 *
 * @private
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
 * Options shared by every panel renderer. `filterCallbacks` is intentionally
 * NOT included: TIN does not pass it, so keep it explicit per renderer instead
 * of folding it into the shared base.
 *
 * @private
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

/**
 * Clamp `config.measureMode` to a supported value, defaulting to `'count'`.
 *
 * @private
 * @param {Object} config
 * @returns {'count' | 'sum' | 'mean'}
 */
function normalizeMeasureMode(config) {
	return ['count', 'sum', 'mean'].includes(config.measureMode) ? config.measureMode : 'count';
}

/** @private */
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

/** @private */
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

/** @private */
function renderPie(container, spec) {
	const config = spec.config || {};
	return renderPieChart(container, spec.dataSnapshot, config.category, {
		...baseOptions(config),
		measureMode: config.measureMode,
		valueColumn: config.valueColumn,
		innerRadius: config.innerRadius,
		outerRadius: config.outerRadius,
		padAngle: config.padAngle,
		zoomScale: config.zoomScale,
		topN: config.topN,
		topNMode: config.topNMode,
		color: config.color,
		showCategoryLabel: config.showCategoryLabel,
		showValueLabel: config.showValueLabel,
		showLegend: config.showLegend,
		labelPosition: config.labelPosition,
		customSliceColors: config.customSliceColors,
		labels: {
			category: t('chive-chart-control-pie-category'),
			count: t('chive-tooltip-count'),
			percentage: t('chive-tooltip-percentage'),
			other: t('chive-chart-pie-other'),
			focusOnThis: t('chive-tooltip-show-only-this'),
			addToFilter: t('chive-tooltip-add-to-filter'),
		},
		filterCallbacks: EMPTY_FILTER_CALLBACKS,
	});
}

/** @private */
function renderBubble(container, spec) {
	const config = spec.config || {};
	const measureMode = normalizeMeasureMode(config);
	return renderBubbleChart(container, spec.dataSnapshot, config.category, {
		...baseOptions(config),
		topN: config.topN,
		measureMode,
		valueColumn: config.valueColumn,
		nestingColumns: config.nestingColumns,
		groupColumn: config.groupColumn,
		nestingMode: config.nestingMode,
		padding: config.padding,
		labelMode: config.labelMode,
		colorScheme: config.colorScheme,
		labels: {
			category: t('chive-chart-control-bubble-category'),
			count: t('chive-tooltip-count'),
			sum: t('chive-tooltip-sum'),
			mean: t('chive-tooltip-mean'),
			group: t('chive-chart-control-bubble-group'),
			children: t('chive-chart-control-bubble-node-children-count'),
			level: t('chive-chart-control-bubble-node-depth'),
		},
		filterCallbacks: EMPTY_FILTER_CALLBACKS,
	});
}

/** @private */
function renderTreemap(container, spec) {
	const config = spec.config || {};
	return renderTreeMap(container, spec.dataSnapshot, config.category, {
		...baseOptions(config),
		measureMode: config.measureMode,
		valueColumn: config.valueColumn,
		topN: config.topN,
		padding: config.padding,
		showLabels: config.showLabels,
		showValues: config.showValues,
		color: config.color,
		colorMode: config.colorMode,
		colorScheme: config.colorScheme,
		labels: {
			category: t('chive-chart-control-treemap-category'),
			count: t('chive-tooltip-count'),
			sum: t('chive-tooltip-sum'),
			percentage: t('chive-tooltip-percentage'),
			focusOnThis: t('chive-tooltip-show-only-this'),
			addToFilter: t('chive-tooltip-add-to-filter'),
		},
		filterCallbacks: EMPTY_FILTER_CALLBACKS,
	});
}

/** @private */
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

/** @private */
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

const RENDERERS = {
	bar: renderBarPanelChart,
	scatter: renderScatter,
	network: renderNetwork,
	pie: renderPie,
	bubble: renderBubble,
	treemap: renderTreemap,
	line: renderLine,
	tin: renderTin,
	scatter3d: renderScatter3dPanelChart,
};

/**
 * Chart types supported by panel rendering. Frozen tuple of {@link ChartTypeKey}
 * values keyed in `RENDERERS`. `panelManager.addChartToPanel` validates
 * incoming snapshot types against this list before adding to the panel.
 *
 * @type {ReadonlyArray<ChartTypeKey>}
 */
export const SUPPORTED_PANEL_CHART_TYPES = Object.freeze(Object.keys(RENDERERS));

/**
 * Render a chart snapshot into `container` by dispatching on `spec.type`.
 *
 * @param {HTMLElement} container - Mount point for the chart's `<svg>` (or `<canvas>` for WebGL charts).
 * @param {ChartSnapshot} spec - Frozen snapshot built by `addChartSnapshot`.
 * @returns {Result} `{ ok: true }` on success; `{ ok: false, reason: 'invalid-args' }` when container or spec are missing; `{ ok: false, reason: 'unknown-type' }` when `spec.type` is not in {@link SUPPORTED_PANEL_CHART_TYPES}.
 */
export function renderChartFromSpec(container, spec) {
	if (!container || !spec) return fail('invalid-args');
	const renderer = RENDERERS[spec.type];
	if (!renderer) return fail('unknown-type');
	return renderer(container, spec);
}
