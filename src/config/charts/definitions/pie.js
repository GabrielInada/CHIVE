/**
 * Pie chart identity, rendering constants, static metadata, and fresh config.
 */

const COLOR = '#5f7c33';

export const PIE_CHART = {
  defaultInnerRadius: 0,
  defaultOuterRadius: 100,
  defaultPadAngle: 0,
  defaultZoomScale: 1,
  minZoomScale: 0.3,
  maxZoomScale: 4,
  minPadAngle: 0,
  maxPadAngle: 12,
  minInnerRadius: 0,
  maxOuterRadius: 140,
  minOuterRadius: 20,
  measureModes: ['count', 'sum'],
  labelPositions: ['inside', 'outside'],
  topNOptions: [0, 10, 20, 50],
  defaultTopN: 0,
  topNModes: ['other', 'truncate'],
  defaultTopNMode: 'other',
  otherSliceColor: '#9c9690',
};

function createDefaultConfig() {
	return {
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
		topN: PIE_CHART.defaultTopN,
		topNMode: PIE_CHART.defaultTopNMode,
		color: COLOR,
		showCategoryLabel: true,
		showValueLabel: true,
		showLegend: true,
		labelPosition: 'inside',
		colorMode: 'uniform',
		colorScheme: 'Colorblind-Safe',
		customSliceColors: {},
	};
}

export const PIE_DEFINITION = Object.freeze({
	key: 'pie',
	color: COLOR,
	dimensions: {
		width: 700,
		height: 360,
		margins: {
			top: 16,
			right: 16,
			bottom: 16,
			left: 16,
		},
	},
	heightLimits: { min: 220, max: 720 },
	workspaceIds: {
		container: 'chart-pie-container',
		block: 'chart-block-pie',
	},
	catalogCategoryKey: 'chive-viz-category-composition',
	createDefaultConfig,
});
