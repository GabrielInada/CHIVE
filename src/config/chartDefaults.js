import { BAR_CHART, CHART_COLORS, NETWORK_GRAPH, PIE_CHART, SCATTER_PLOT } from './charts.js';

export function createDefaultChartConfig() {
	return {
		aba: 'preview',
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
			color: CHART_COLORS.pie,
			showCategoryLabel: true,
			showValueLabel: true,
			showLegend: true,
			labelPosition: 'inside',
			colorMode: 'uniform',
			colorScheme: 'Bold',
			customSliceColors: {},
		},
	};
}

export function mergeChartConfigWithDefaults(configGraficos) {
	const defaults = createDefaultChartConfig();
	const config = configGraficos || {};

	return {
		...defaults,
		...config,
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
	};
}