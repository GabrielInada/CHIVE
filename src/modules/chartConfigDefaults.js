import { CHART_COLORS } from '../config/index.js';

export function createDefaultChartConfig() {
	return {
		aba: 'preview',
		bar: {
			enabled: false,
			category: null,
			expanded: false,
			customTitle: '',
			chartHeight: 320,
			sort: 'count-desc',
			topN: 10,
			color: CHART_COLORS.bar,
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
			xScale: 'linear',
			yScale: 'linear',
			radius: 3,
			opacity: 0.7,
			color: CHART_COLORS.scatter,
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
			nodeRadius: 5,
			linkDistance: 46,
			chargeStrength: -80,
			linkOpacity: 0.45,
			zoomScale: 1,
			alphaDecay: 0.045,
			showLegend: true,
			showNodeLabels: false,
		},
		pie: {
			enabled: false,
			category: null,
			measureMode: 'count',
			valueColumn: null,
			expanded: false,
			customTitle: '',
			chartHeight: 360,
			innerRadius: 0,
			outerRadius: 100,
			padAngle: 0,
			color: CHART_COLORS.pie,
			showCategoryLabel: true,
			showValueLabel: true,
			showLegend: true,
			labelPosition: 'inside',
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
