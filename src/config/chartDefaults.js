import { BAR_CHART, BUBBLE_CHART, CHART_COLORS, NETWORK_GRAPH, PIE_CHART, SCATTER_PLOT, TREEMAP_CHART } from './charts.js';
import { createDefaultFilterConfig as createDefaultFilter } from '../utils/chartFilters.js';

export function createDefaultChartConfig() {
	return {
		aba: 'preview',
		globalFilter: createDefaultFilter(),
		bar: {
			enabled: false,
			category: null,
			expanded: false,
			customTitle: '',
			chartHeight: 320,
			sort: BAR_CHART.defaultSort,
			topN: BAR_CHART.defaultTopN,
			color: CHART_COLORS.bar,
			colorMode: 'uniform',
			colorScheme: 'Bold',
			gradientMinColor: CHART_COLORS.bar,
			gradientMaxColor: '#ffffff',
			manualThresholdPct: 50,
			showXAxisLabel: true,
			showYAxisLabel: true,
			measureMode: BAR_CHART.defaultMeasureMode,
			valueColumn: null,
		},
		scatter: {
			enabled: false,
			x: null,
			y: null,
			expanded: false,
			customTitle: '',
			chartHeight: 320,
			xScale: SCATTER_PLOT.defaultScale,
			yScale: SCATTER_PLOT.defaultScale,
			radius: SCATTER_PLOT.defaultRadius,
			opacity: SCATTER_PLOT.defaultOpacity,
			color: CHART_COLORS.scatter,
			colorMode: 'uniform',
			colorField: null,
			colorFieldType: null,
			gradientMinColor: CHART_COLORS.scatter,
			gradientMaxColor: '#ffffff',
			colorScheme: 'Bold',
			showXAxisLabel: true,
			showYAxisLabel: true,
		},
		network: {
			enabled: false,
			expanded: false,
			customTitle: '',
			chartHeight: 420,
			source: null,
			target: null,
			weight: null,
			group: null,
			nodeRadius: NETWORK_GRAPH.defaultNodeRadius,
			linkDistance: NETWORK_GRAPH.defaultLinkDistance,
			chargeStrength: NETWORK_GRAPH.defaultChargeStrength,
			linkOpacity: NETWORK_GRAPH.defaultLinkOpacity,
			zoomScale: NETWORK_GRAPH.defaultZoomScale,
			alphaDecay: NETWORK_GRAPH.defaultAlphaDecay,
			showLegend: true,
			showNodeLabels: false,
			colorScheme: 'Bold',
			sourceNodeColor: '#e3743d',
			targetNodeColor: '#6b94c9',
			edgeColorMode: 'gradient',
		},
		pie: {
			enabled: false,
			category: null,
			measureMode: 'count',
			valueColumn: null,
			expanded: false,
			customTitle: '',
			chartHeight: 360,
			innerRadius: PIE_CHART.defaultInnerRadius,
			outerRadius: PIE_CHART.defaultOuterRadius,
			padAngle: PIE_CHART.defaultPadAngle,
			zoomScale: PIE_CHART.defaultZoomScale,
			color: CHART_COLORS.pie,
			showCategoryLabel: true,
			showValueLabel: true,
			showLegend: true,
			labelPosition: 'inside',
			colorMode: 'uniform',
			colorScheme: 'Bold',
			customSliceColors: {},
		},
		treemap: {
			enabled: false,
			category: null,
			measureMode: TREEMAP_CHART.defaultMeasureMode,
			valueColumn: null,
			topN: TREEMAP_CHART.defaultTopN,
			padding: TREEMAP_CHART.defaultPadding,
			expanded: false,
			customTitle: '',
			chartHeight: 380,
			color: CHART_COLORS.treemap,
			colorMode: 'scheme',
			colorScheme: 'Bold',
			showLabels: true,
			showValues: true,
		},
		bubble: {
			enabled: false,
			expanded: false,
			category: null,
			groupColumn: null,
			nestingColumns: [],
			customTitle: '',
			chartHeight: 700,
			topN: BUBBLE_CHART.defaultTopN,
			measureMode: BUBBLE_CHART.defaultMeasureMode,
			valueColumn: null,
			padding: BUBBLE_CHART.defaultPadding,
			labelMode: BUBBLE_CHART.defaultLabelMode,
			nestingMode: BUBBLE_CHART.defaultNestingMode,
			colorScheme: 'Tableau10',
		},
	};
}

function pickGlobalFilter(config) {
	if (config && typeof config === 'object' && config.globalFilter && typeof config.globalFilter === 'object') {
		return { ...createDefaultFilter(), ...config.globalFilter };
	}
	return createDefaultFilter();
}

export function mergeChartConfigWithDefaults(configGraficos) {
	const defaults = createDefaultChartConfig();
	const config = configGraficos || {};

	return {
		...defaults,
		...config,
		globalFilter: pickGlobalFilter(config),
		bar: {
			...defaults.bar,
			...(config.bar || {}),
		},
		scatter: {
			...defaults.scatter,
			...(config.scatter || {}),
		},
		network: {
			...defaults.network,
			...(config.network || {}),
		},
		pie: {
			...defaults.pie,
			...(config.pie || {}),
		},
		treemap: {
			...defaults.treemap,
			...(config.treemap || {}),
		},
		bubble: (() => {
			const merged = { ...defaults.bubble, ...(config.bubble || {}) };
			if (Array.isArray(merged.nestingColumns) && merged.nestingColumns.length > 0) {
				// nestingColumns already set, keep it
			} else if (merged.groupColumn && typeof merged.groupColumn === 'string') {
				merged.nestingColumns = [merged.groupColumn];
			} else {
				merged.nestingColumns = [];
			}
			return merged;
		})(),
	};
}
