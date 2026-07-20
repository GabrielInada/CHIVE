/**
 * Network chart identity, rendering constants, static metadata, and fresh config.
 */

const COLOR = '#3b6a9f';

export const NETWORK_GRAPH = {
  maxNodes: 1000,
  maxLinks: 2000,
  defaultNodeRadius: 5,
  defaultLinkDistance: 46,
  defaultChargeStrength: -80,
  defaultLinkOpacity: 0.45,
  defaultZoomScale: 1,
  defaultAlphaDecay: 0.045,
  minZoomScale: 0.3,
  maxZoomScale: 4,
  minAlphaDecay: 0.01,
  maxAlphaDecay: 0.2,
};

function createDefaultConfig() {
	return {
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
		colorScheme: 'Colorblind-Safe',
		sourceNodeColor: '#e3743d',
		targetNodeColor: '#6b94c9',
		edgeColorMode: 'gradient',
	};
}

export const NETWORK_DEFINITION = Object.freeze({
	key: 'network',
	color: COLOR,
	dimensions: null,
	heightLimits: { min: 220, max: 720 },
	workspaceIds: {
		container: 'chart-network-container',
		block: 'chart-block-network',
	},
	catalogCategoryKey: 'chive-viz-category-relationship',
	createDefaultConfig,
});
