/**
 * Treemap identity, rendering constants, static metadata, and fresh config.
 */

const COLOR = '#5a7d99';

export const TREEMAP_CHART = {
  measureModes: ['count', 'sum'],
  defaultMeasureMode: 'count',
  topNOptions: [0, 10, 20, 50],
  defaultTopN: 20,
  paddingOptions: [1, 2, 4],
  defaultPadding: 2,
};

function createDefaultConfig() {
	return {
		enabled: false,
		category: null,
		measureMode: TREEMAP_CHART.defaultMeasureMode,
		valueColumn: null,
		topN: TREEMAP_CHART.defaultTopN,
		padding: TREEMAP_CHART.defaultPadding,
		expanded: false,
		customTitle: '',
		chartHeight: 380,
		color: COLOR,
		colorMode: 'scheme',
		colorScheme: 'Colorblind-Safe',
		showLabels: true,
		showValues: true,
	};
}

export const TREEMAP_DEFINITION = Object.freeze({
	key: 'treemap',
	color: COLOR,
	dimensions: null,
	heightLimits: { min: 220, max: 720 },
	workspaceIds: {
		container: 'chart-treemap-container',
		block: 'chart-block-treemap',
	},
	catalogCategoryKey: 'chive-viz-category-composition',
	createDefaultConfig,
});
