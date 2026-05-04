import { t, getLocale } from '../../services/i18nService.js';
import {
	renderBarChart,
	renderBubbleChart,
	renderNetworkGraph,
	renderPieChart,
	renderScatterPlot,
	renderTreeMap,
} from '../visualizations/index.js';
import { fail } from '../../utils/result.js';

const EMPTY_FILTER_CALLBACKS = Object.freeze({});

function buildColumnTypeIndex(columnsSnapshot) {
	if (!Array.isArray(columnsSnapshot)) return {};
	const index = {};
	for (const column of columnsSnapshot) {
		if (column?.nome) index[column.nome] = column.tipo;
	}
	return index;
}

function renderBar(container, spec) {
	const config = spec.config || {};
	const measureMode = ['count', 'sum', 'mean'].includes(config.measureMode)
		? config.measureMode
		: 'count';
	const yAxisLabel = measureMode === 'mean'
		? t('chive-tooltip-mean')
		: measureMode === 'sum'
			? t('chive-tooltip-sum')
			: t('chive-tooltip-count');

	return renderBarChart(container, spec.dataSnapshot, config.category, {
		customTitle: config.customTitle,
		chartHeight: config.chartHeight,
		ordenacao: config.sort,
		topN: config.topN,
		color: config.color,
		colorMode: config.colorMode,
		gradientMinColor: config.gradientMinColor,
		gradientMaxColor: config.gradientMaxColor,
		gradientDistribution: config.gradientDistribution,
		manualThresholdPct: config.manualThresholdPct,
		measureMode,
		valueColumn: config.valueColumn,
		showXAxisLabel: config.showXAxisLabel,
		showYAxisLabel: config.showYAxisLabel,
		axisLabels: {
			x: config.category || t('chive-chart-control-bar-category'),
			y: yAxisLabel,
		},
		locale: getLocale(),
		labels: {
			categoria: t('chive-chart-control-bar-category'),
			contagem: t('chive-tooltip-count'),
			soma: t('chive-tooltip-sum'),
			media: t('chive-tooltip-mean'),
			percentual: t('chive-tooltip-percentage'),
			focusOnThis: t('chive-tooltip-show-only-this'),
			addToFilter: t('chive-tooltip-add-to-filter'),
		},
		filterCallbacks: EMPTY_FILTER_CALLBACKS,
	});
}

function renderScatter(container, spec) {
	const config = spec.config || {};
	const columnTypeByName = buildColumnTypeIndex(spec.columnsSnapshot);
	return renderScatterPlot(container, spec.dataSnapshot, config.x, config.y, {
		customTitle: config.customTitle,
		chartHeight: config.chartHeight,
		xScale: config.xScale,
		yScale: config.yScale,
		radius: config.radius,
		opacity: config.opacity,
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
		axisLabels: {
			x: config.x || t('chive-chart-control-scatter-x'),
			y: config.y || t('chive-chart-control-scatter-y'),
		},
		axisTypes: {
			x: columnTypeByName[config.x],
			y: columnTypeByName[config.y],
		},
		locale: getLocale(),
		labels: {
			eixoX: t('chive-chart-control-scatter-x'),
			eixoY: t('chive-chart-control-scatter-y'),
			indice: t('chive-tooltip-row'),
			count: t('chive-tooltip-count'),
		},
		xColumn: config.x,
		yColumn: config.y,
		filterCallbacks: EMPTY_FILTER_CALLBACKS,
	});
}

function renderNetwork(container, spec) {
	const config = spec.config || {};
	return renderNetworkGraph(container, spec.dataSnapshot, config.source, config.target, {
		customTitle: config.customTitle,
		chartHeight: config.chartHeight,
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
		locale: getLocale(),
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

function renderPie(container, spec) {
	const config = spec.config || {};
	return renderPieChart(container, spec.dataSnapshot, config.category, {
		customTitle: config.customTitle,
		chartHeight: config.chartHeight,
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
		locale: getLocale(),
		labels: {
			categoria: t('chive-chart-control-pie-category'),
			contagem: t('chive-tooltip-count'),
			percentual: t('chive-tooltip-percentage'),
			other: t('chive-chart-pie-other'),
			focusOnThis: t('chive-tooltip-show-only-this'),
			addToFilter: t('chive-tooltip-add-to-filter'),
		},
		filterCallbacks: EMPTY_FILTER_CALLBACKS,
	});
}

function renderBubble(container, spec) {
	const config = spec.config || {};
	const measureMode = ['count', 'sum', 'mean'].includes(config.measureMode)
		? config.measureMode
		: 'count';
	return renderBubbleChart(container, spec.dataSnapshot, config.category, {
		customTitle: config.customTitle,
		chartHeight: config.chartHeight,
		topN: config.topN,
		measureMode,
		valueColumn: config.valueColumn,
		nestingColumns: config.nestingColumns,
		groupColumn: config.groupColumn,
		nestingMode: config.nestingMode,
		padding: config.padding,
		labelMode: config.labelMode,
		colorScheme: config.colorScheme,
		locale: getLocale(),
		labels: {
			categoria: t('chive-chart-control-bubble-category'),
			contagem: t('chive-tooltip-count'),
			soma: t('chive-tooltip-sum'),
			media: t('chive-tooltip-mean'),
			grupo: t('chive-chart-control-bubble-group'),
			filhos: t('chive-chart-control-bubble-node-children-count'),
			nivel: t('chive-chart-control-bubble-node-depth'),
		},
		filterCallbacks: EMPTY_FILTER_CALLBACKS,
	});
}

function renderTreemap(container, spec) {
	const config = spec.config || {};
	return renderTreeMap(container, spec.dataSnapshot, config.category, {
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
			categoria: t('chive-chart-control-treemap-category'),
			contagem: t('chive-tooltip-count'),
			soma: t('chive-tooltip-sum'),
			percentual: t('chive-tooltip-percentage'),
			focusOnThis: t('chive-tooltip-show-only-this'),
			addToFilter: t('chive-tooltip-add-to-filter'),
		},
		filterCallbacks: EMPTY_FILTER_CALLBACKS,
	});
}

const RENDERERS = {
	bar: renderBar,
	scatter: renderScatter,
	network: renderNetwork,
	pie: renderPie,
	bubble: renderBubble,
	treemap: renderTreemap,
};

export const SUPPORTED_PANEL_CHART_TYPES = Object.freeze(Object.keys(RENDERERS));

export function renderChartFromSpec(container, spec) {
	if (!container || !spec) return fail('invalid-args');
	const renderer = RENDERERS[spec.type];
	if (!renderer) return fail('unknown-type');
	return renderer(container, spec);
}
