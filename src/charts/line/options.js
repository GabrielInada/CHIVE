/**
 * Line-chart option normalization.
 *
 * Turns the stored chart config into a validated config object with every
 * default and bound applied exactly once. Mirrors the renderer's historical
 * semantics verbatim. The x-axis kind (data-derived) and the d3 curve lookup
 * stay in `renderers/svg.js`. Pure: no DOM, no d3. Used by `renderers/svg.js`.
 */

import { CHART_COLORS, CHART_DIMENSIONS } from '../../config/charts/definitions.js';
import { LINE_CHART } from '../../config/charts/definitions/line.js';
import { isValidHexColor } from '../../utils/colorUtils.js';

/** @private */
function normalizeHex(value, fallback) {
	const trimmed = String(value || '').trim();
	return isValidHexColor(trimmed) ? trimmed : fallback;
}

/**
 * Normalize the line render config.
 *
 * @param {Object} config - Stored chart config.
 * @returns {Object} Validated config locals.
 */
export function normalizeLineOptions(config) {
	// Read as given: chart config canonicalization checks the enumerated
	// settings against the chart's definition.
	const { missingMode, aggregateMode } = config;
	const strokeWidth = Number.isFinite(Number(config.strokeWidth))
		? Math.max(0.5, Math.min(8, Number(config.strokeWidth)))
		: LINE_CHART.defaultStrokeWidth;
	const color = normalizeHex(config.color, CHART_COLORS.line);
	const ghostColor = normalizeHex(config.ghostStrokeColor, LINE_CHART.defaultGhostStrokeColor);
	const showPoints = config.showPoints === true;
	const sortX = config.sortX !== false;
	const showXAxisLabel = config.showXAxisLabel !== false;
	const showYAxisLabel = config.showYAxisLabel !== false;
	const customTitle = String(config.customTitle || '').trim().slice(0, 80);
	const chartHeight = Number.isFinite(Number(config.chartHeight))
		? Math.max(220, Math.min(720, Number(config.chartHeight)))
		: CHART_DIMENSIONS.line.height;

	return {
		missingMode,
		strokeWidth,
		color,
		ghostColor,
		showPoints,
		sortX,
		aggregateMode,
		showXAxisLabel,
		showYAxisLabel,
		customTitle,
		chartHeight,
	};
}
