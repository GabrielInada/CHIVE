/**
 * Line chart identity, rendering constants, static metadata, and fresh config.
 */

const COLOR = '#4e79a7';

export const LINE_CHART = {
  curveOptions: ['linear', 'monotone', 'step', 'step-before', 'step-after', 'basis', 'cardinal'],
  defaultCurve: 'linear',
  missingModes: ['connect', 'gap', 'interpolate'],
  defaultMissingMode: 'connect',
  strokeWidthOptions: [1, 1.5, 2, 3, 4],
  defaultStrokeWidth: 1.5,
  aggregateModes: ['none', 'mean', 'sum', 'count'],
  defaultAggregateMode: 'none',
  defaultPointsVisible: false,
  defaultSortX: true,
  defaultGhostStrokeColor: '#cccccc',
  pointRadius: 3,
};

function createDefaultConfig() {
	return {
		enabled: false,
		expanded: false,
		x: null,
		y: null,
		customTitle: '',
		chartHeight: 320,
		curve: LINE_CHART.defaultCurve,
		missingMode: LINE_CHART.defaultMissingMode,
		strokeWidth: LINE_CHART.defaultStrokeWidth,
		color: COLOR,
		ghostStrokeColor: LINE_CHART.defaultGhostStrokeColor,
		showPoints: LINE_CHART.defaultPointsVisible,
		sortX: LINE_CHART.defaultSortX,
		aggregateMode: LINE_CHART.defaultAggregateMode,
		showXAxisLabel: true,
		showYAxisLabel: true,
	};
}

export const LINE_DEFINITION = Object.freeze({
	key: 'line',
	color: COLOR,
	dimensions: {
		width: 700,
		height: 320,
		margins: {
			top: 20,
			right: 30,
			bottom: 44,
			left: 52,
		},
	},
	heightLimits: { min: 220, max: 720 },
	workspaceIds: {
		container: 'chart-line-container',
		block: 'chart-block-line',
	},
	catalogCategoryKey: 'chive-viz-category-trend',
	createDefaultConfig,
});
