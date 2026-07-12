/**
 * Line-chart option normalization.
 *
 * Turns the raw render options bag into a validated config object with every
 * default and bound applied exactly once. Mirrors the renderer's historical
 * semantics verbatim. The x-axis kind (data-derived) and the d3 curve lookup
 * stay in `renderers/svg.js`. Pure: no DOM, no d3. Used by `renderers/svg.js`.
 */

import { CHART_COLORS, CHART_DIMENSIONS, LINE_CHART } from '../../config/charts.js';
import { isValidHexColor } from '../../utils/colorUtils.js';

/** @private */
function normalizeHex(value, fallback) {
	const trimmed = String(value || '').trim();
	return isValidHexColor(trimmed) ? trimmed : fallback;
}

/**
 * Normalize the line render options.
 *
 * @param {Object} options - Raw render options.
 * @param {string} xColumn - X data column (for the default x label).
 * @param {string} yColumn - Y data column (for the default y label).
 * @returns {Object} Validated config locals.
 */
export function normalizeLineOptions(options, xColumn, yColumn) {
	const missingMode = LINE_CHART.missingModes.includes(options.missingMode)
		? options.missingMode
		: LINE_CHART.defaultMissingMode;
	const strokeWidth = Number.isFinite(Number(options.strokeWidth))
		? Math.max(0.5, Math.min(8, Number(options.strokeWidth)))
		: LINE_CHART.defaultStrokeWidth;
	const color = normalizeHex(options.color, CHART_COLORS.line);
	const ghostColor = normalizeHex(options.ghostStrokeColor, LINE_CHART.defaultGhostStrokeColor);
	const showPoints = options.showPoints === true;
	const sortX = options.sortX !== false;
	const aggregateMode = LINE_CHART.aggregateModes.includes(options.aggregateMode)
		? options.aggregateMode
		: 'none';
	const showXAxisLabel = options.showXAxisLabel !== false;
	const showYAxisLabel = options.showYAxisLabel !== false;
	const customTitle = String(options.customTitle || '').trim().slice(0, 80);
	const chartHeight = Number.isFinite(Number(options.chartHeight))
		? Math.max(220, Math.min(720, Number(options.chartHeight)))
		: CHART_DIMENSIONS.line.height;
	const axisLabels = {
		x: options.axisLabels?.x || xColumn,
		y: options.axisLabels?.y || yColumn,
	};
	const locale = options.locale || undefined;

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
		axisLabels,
		locale,
	};
}
