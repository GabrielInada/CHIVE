/**
 * Treemap identity, rendering constants, static metadata, and fresh config.
 */

import { CHART_COLOR_PALETTE_NAMES } from '../shared.js';

const COLOR = '#5a7d99';

export const TREEMAP_CHART = {
  measureModes: ['count', 'sum'],
  defaultMeasureMode: 'count',
  topNOptions: [0, 10, 20, 50],
  defaultTopN: 20,
  defaultPadding: 2,
	colorModes: ['scheme', 'uniform'],
  // Config key -> palette position for the color palette buttons.
  presetColorKeys: { color: 0 },
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
	allowedValues: {
		measureMode: TREEMAP_CHART.measureModes,
		colorMode: TREEMAP_CHART.colorModes,
		colorScheme: CHART_COLOR_PALETTE_NAMES,
	},
	createDefaultConfig,
});
