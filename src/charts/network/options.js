/** Pure normalization of stored network config. Labels and callbacks belong to presentation. */

import { NETWORK_GRAPH } from '../../config/charts/definitions/network.js';
import { isValidHexColor } from '../../utils/colorUtils.js';

/**
 * @param {Object} config - Stored chart config.
 * @returns {Object} Normalized drawing values.
 */
export function normalizeNetworkOptions(config) {
	const weightColumn = config.weight || null;
	const groupColumn = config.group || null;
	const nodeRadius = Number.isFinite(Number(config.nodeRadius)) ? Number(config.nodeRadius) : 5;
	const linkOpacity = Number.isFinite(Number(config.linkOpacity)) ? Number(config.linkOpacity) : 0.45;
	const chargeStrength = Number.isFinite(Number(config.chargeStrength)) ? Number(config.chargeStrength) : -80;
	const linkDistance = Number.isFinite(Number(config.linkDistance)) ? Number(config.linkDistance) : 46;
	const zoomScale = Number.isFinite(Number(config.zoomScale))
		? Number(config.zoomScale)
		: NETWORK_GRAPH.defaultZoomScale;
	const alphaDecay = Number.isFinite(Number(config.alphaDecay))
		? Number(config.alphaDecay)
		: NETWORK_GRAPH.defaultAlphaDecay;
	const showLegend = config.showLegend !== false;
	const showNodeLabels = config.showNodeLabels === true;
	const sourceNodeColor = isValidHexColor(String(config.sourceNodeColor || '').trim())
		? String(config.sourceNodeColor).trim()
		: '#e3743d';
	const targetNodeColor = isValidHexColor(String(config.targetNodeColor || '').trim())
		? String(config.targetNodeColor).trim()
		: '#6b94c9';
	// Read as given: chart config canonicalization checks the edge color mode
	// against the chart's definition.
	const { edgeColorMode } = config;
	const customTitle = String(config.customTitle || '').trim().slice(0, 80);
	const chartHeight = Number.isFinite(Number(config.chartHeight))
		? Math.max(220, Math.min(720, Number(config.chartHeight)))
		: 420;
	return {
		weightColumn, groupColumn, nodeRadius, linkOpacity, chargeStrength, linkDistance,
		zoomScale, alphaDecay, showLegend, showNodeLabels, sourceNodeColor, targetNodeColor,
		edgeColorMode, customTitle, chartHeight,
	};
}
