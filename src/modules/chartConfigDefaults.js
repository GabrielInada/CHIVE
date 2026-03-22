import { CHART_COLORS } from '../config/index.js';

export function createDefaultChartConfig() {
	return {
		aba: 'preview',
		bar: {
			enabled: false,
			category: null,
			expanded: false,
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
			xScale: 'linear',
			yScale: 'linear',
			radius: 3,
			opacity: 0.7,
			color: CHART_COLORS.scatter,
			showXAxisLabel: true,
			showYAxisLabel: true,
		},
		pie: {
			enabled: false,
			category: null,
			measureMode: 'count',
			valueColumn: null,
			expanded: false,
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
		pie: {
			...defaults.pie,
			...(config.pie || {}),
		},
	};
}
