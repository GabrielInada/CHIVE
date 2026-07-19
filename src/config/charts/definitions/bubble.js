/**
 * Bubble chart identity, rendering constants, static metadata, and fresh config.
 */

const COLOR = '#7b4f9d';

export const BUBBLE_CHART = {
  defaultPadding: 3,
  topNOptions: [0, 10, 20, 50],
  defaultTopN: 10,
  measureModes: ['count', 'sum', 'mean'],
  defaultMeasureMode: 'count',
  labelModes: ['all', 'hover', 'auto'],
  defaultLabelMode: 'auto',
  autoLabelMinRadius: 20,
  nestingModes: ['flat', 'grouped'],
  defaultNestingMode: 'flat',
  defaultNestingColumns: [],
  parentLabelMinRadius: 40,
  zoomTransitionDuration: 600,
  zoomScalePadding: 1.1,
  shallowPaddingBoost: 2,
  deepPaddingMin: 1,
  maxInitialNestingControlsVisible: 1,
  maxNestingDepth: 8,
};

function createDefaultConfig() {
	return {
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
	};
}

export const BUBBLE_DEFINITION = Object.freeze({
	key: 'bubble',
	color: COLOR,
	dimensions: {
		width: 700,
		height: 700,
		margins: {
			top: 10,
			right: 10,
			bottom: 10,
			left: 10,
		},
	},
	heightLimits: { min: 400, max: 900 },
	workspaceIds: {
		container: 'chart-bubble-container',
		block: 'chart-block-bubble',
	},
	catalogCategoryKey: 'chive-viz-category-hierarchy',
	createDefaultConfig,
});
