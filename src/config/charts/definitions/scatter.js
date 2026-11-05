/**
 * Scatter chart identity, rendering constants, static metadata, and fresh config.
 */

import { CHART_COLOR_PALETTE_NAMES, CHART_GRADIENT_DISTRIBUTIONS } from '../shared.js';

const COLOR = '#1a472a';

export const SCATTER_PLOT = {
  ticks: 8,
  maxPoints: 5000,
  scaleOptions: ['linear', 'log'],
  defaultScale: 'linear',
  radiusOptions: [2, 3, 4, 6],
  defaultRadius: 3,
  opacityOptions: [0.3, 0.5, 0.7, 1],
  defaultOpacity: 0.7,
	sizeModes: ['uniform', 'numeric'],
	categoricalPairModes: ['jitter', 'aggregate'],
	colorModes: ['uniform', 'numeric', 'category'],
	regressionModes: ['overall', 'perCategory'],
  // Config key -> palette position for the color palette buttons.
  presetColorKeys: { color: 0, gradientMinColor: 0, gradientMaxColor: -1 },
};

function createDefaultConfig() {
	return {
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
		sizeMode: 'uniform',
		sizeField: null,
		sizeMin: 2,
		sizeMax: 12,
		categoricalPairMode: 'jitter',
		color: COLOR,
		colorMode: 'uniform',
		colorField: null,
		colorFieldType: null,
		gradientMinColor: COLOR,
		gradientMaxColor: '#ffffff',
		gradientDistribution: 'value',
		colorScheme: 'Colorblind-Safe',
		showXAxisLabel: true,
		showYAxisLabel: true,
		regression: {
			enabled: false,
			mode: 'overall',
			showLine: true,
			showCI: true,
			showEquation: true,
			showR2: true,
			lineWidth: 2,
			lineOpacity: 0.9,
			bandOpacity: 0.18,
			overallColor: null,
		},
	};
}

export const SCATTER_DEFINITION = Object.freeze({
	key: 'scatter',
	color: COLOR,
	dimensions: {
		width: 700,
		height: 320,
		margins: {
			top: 12,
			right: 12,
			bottom: 44,
			left: 52,
		},
	},
	heightLimits: { min: 220, max: 720 },
	workspaceIds: {
		container: 'chart-scatter-container',
		block: 'chart-block-scatter',
	},
	catalogCategoryKey: 'chive-viz-category-relationship',
	allowedValues: {
		xScale: SCATTER_PLOT.scaleOptions,
		yScale: SCATTER_PLOT.scaleOptions,
		sizeMode: SCATTER_PLOT.sizeModes,
		categoricalPairMode: SCATTER_PLOT.categoricalPairModes,
		colorMode: SCATTER_PLOT.colorModes,
		gradientDistribution: CHART_GRADIENT_DISTRIBUTIONS,
		colorScheme: CHART_COLOR_PALETTE_NAMES,
		regression: {
			mode: SCATTER_PLOT.regressionModes,
		},
	},
	createDefaultConfig,
});
