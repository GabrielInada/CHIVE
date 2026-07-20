/**
 * Bar chart identity, rendering constants, static metadata, and fresh config.
 */

const COLOR = '#d4622a';

export const BAR_CHART = {
  padding: 0.14,
  ticks: 6,
  sortOptions: ['count-desc', 'count-asc', 'label-asc', 'label-desc'],
  defaultSort: 'count-desc',
  topNOptions: [0, 10, 20, 50],
  defaultTopN: 10,
  measureModes: ['count', 'sum', 'mean'],
  defaultMeasureMode: 'count',
};

function createDefaultConfig() {
	return {
		enabled: false,
		category: null,
		expanded: false,
		customTitle: '',
		chartHeight: 320,
		sort: BAR_CHART.defaultSort,
		topN: BAR_CHART.defaultTopN,
		color: COLOR,
		colorMode: 'uniform',
		colorScheme: 'Colorblind-Safe',
		gradientMinColor: COLOR,
		gradientMaxColor: '#ffffff',
		gradientDistribution: 'value',
		manualThresholdPct: 50,
		showXAxisLabel: true,
		showYAxisLabel: true,
		measureMode: BAR_CHART.defaultMeasureMode,
		valueColumn: null,
	};
}

export const BAR_DEFINITION = Object.freeze({
	key: 'bar',
	color: COLOR,
	dimensions: {
		width: 700,
		height: 320,
		margins: {
			top: 12,
			right: 12,
			bottom: 90,
			left: 52,
		},
	},
	heightLimits: { min: 220, max: 720 },
	workspaceIds: {
		container: 'chart-bar-container',
		block: 'chart-block-bar',
	},
	catalogCategoryKey: 'chive-viz-category-comparison',
	createDefaultConfig,
});
