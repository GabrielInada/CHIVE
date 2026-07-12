/**
 * TIN render-option normalization.
 *
 * Turns the raw render options bag into a validated config object with every
 * default, bound, and enum collapse applied exactly once. Pure: no DOM, no d3.
 * Owns the ramp-enum normalization (`resolveColorRamp`, config-only) so the
 * d3-loading color module never has to. Used by `renderers/svg.js`.
 */

import { CHART_COLORS, CHART_DIMENSIONS, TIN_CHART, TIN_COLOR_RAMPS } from '../../config/charts.js';
import { isValidHexColor } from '../../utils/colorUtils.js';

function normalizeColor(value, fallback) {
	const v = String(value || '').trim();
	return isValidHexColor(v) ? v : fallback;
}

/** Collapse an arbitrary ramp name to a known ramp or 'custom'. Config-only, no d3. */
function resolveColorRamp(rampName) {
	return TIN_COLOR_RAMPS.includes(rampName) ? rampName : 'custom';
}

/**
 * Normalize the TIN render options into a validated config object. Mirrors the
 * renderer's historical semantics exactly. `requestedSubdivisionDepth` carries
 * the raw subdivision request verbatim; the data-dependent rounding and budget
 * clamp stay in `resolveSurfaceDepth` (it needs the triangle count). This is the
 * single place that reads `options.subdivisionDepth`.
 *
 * @param {Object} options - Raw render options bag.
 * @param {string} xColumn - X data column (default x label).
 * @param {string} yColumn - Y data column (default y label).
 * @param {string} zColumn - Z data column (default z label).
 * @returns {Object} Validated config locals.
 */
export function normalizeTinOptions(options, xColumn, yColumn, zColumn) {
	const fillMode = options.fillMode === 'flat' ? 'flat' : 'smooth';
	const colorRenderingMode = options.colorRenderingMode === 'full-ramp' ? 'full-ramp' : 'optimized';
	const gradientMin = normalizeColor(options.gradientMinColor, CHART_COLORS.tin);
	const gradientMax = normalizeColor(options.gradientMaxColor, '#ffffff');
	const gradientDistribution = options.gradientDistribution === 'rank' ? 'rank' : 'value';
	const colorRamp = resolveColorRamp(options.colorRamp);
	const showEdges = options.showEdges !== false;
	const edgeColor = normalizeColor(options.edgeColor, TIN_CHART.defaultEdgeColor);
	const showPoints = options.showPoints !== false;
	const pointRadius = Number.isFinite(Number(options.pointRadius))
		? Math.max(1, Number(options.pointRadius))
		: TIN_CHART.defaultPointRadius;
	const showZLabels = options.showZLabels === true;
	const showHull = options.showHull === true;
	const hullColor = normalizeColor(options.hullColor, TIN_CHART.defaultHullColor);
	const showIsolines = options.showIsolines === true;
	const isolineMode = options.isolineMode === 'step' ? 'step' : 'count';
	const isolineCountRaw = Math.round(Number(options.isolineCount));
	const isolineCount = Number.isFinite(isolineCountRaw)
		? Math.max(TIN_CHART.minIsolineCount, Math.min(TIN_CHART.maxIsolineCount, isolineCountRaw))
		: TIN_CHART.defaultIsolineCount;
	const isolineStepRaw = Number(options.isolineStep);
	const isolineStep = Number.isFinite(isolineStepRaw) && isolineStepRaw > 0
		? isolineStepRaw
		: TIN_CHART.defaultIsolineStep;
	const isolineColor = normalizeColor(options.isolineColor, TIN_CHART.defaultIsolineColor);
	const isolineWidthRaw = Number(options.isolineWidth);
	const isolineWidth = Number.isFinite(isolineWidthRaw)
		? Math.max(TIN_CHART.minIsolineWidth, Math.min(TIN_CHART.maxIsolineWidth, isolineWidthRaw))
		: TIN_CHART.defaultIsolineWidth;
	const showIsolineLabels = options.showIsolineLabels === true;
	const isolineLabelSizeRaw = Math.round(Number(options.isolineLabelSize));
	const isolineLabelSize = Number.isFinite(isolineLabelSizeRaw)
		? Math.max(TIN_CHART.minIsolineLabelSize, Math.min(TIN_CHART.maxIsolineLabelSize, isolineLabelSizeRaw))
		: TIN_CHART.defaultIsolineLabelSize;
	const isolineLabelColor = normalizeColor(options.isolineLabelColor, TIN_CHART.defaultIsolineLabelColor);
	const colorIsolinesByZ = options.colorIsolinesByZ === true;
	const isolineMinColor = normalizeColor(options.isolineMinColor, TIN_CHART.defaultIsolineMinColor);
	const isolineMaxColor = normalizeColor(options.isolineMaxColor, TIN_CHART.defaultIsolineMaxColor);
	const showThreshold = options.showThreshold === true;
	const thresholdValueRaw = Number(options.thresholdValue);
	const thresholdValue = Number.isFinite(thresholdValueRaw)
		? thresholdValueRaw
		: TIN_CHART.defaultThresholdValue;
	const thresholdColor = normalizeColor(options.thresholdColor, TIN_CHART.defaultThresholdColor);
	const thresholdWidthRaw = Number(options.thresholdWidth);
	const thresholdWidth = Number.isFinite(thresholdWidthRaw)
		? Math.max(TIN_CHART.minThresholdWidth, Math.min(TIN_CHART.maxThresholdWidth, thresholdWidthRaw))
		: TIN_CHART.defaultThresholdWidth;
	const showXAxisLabel = options.showXAxisLabel !== false;
	const showYAxisLabel = options.showYAxisLabel !== false;
	const customTitle = String(options.customTitle || '').trim().slice(0, 80);
	const chartHeight = Number.isFinite(Number(options.chartHeight))
		? Math.max(220, Math.min(900, Number(options.chartHeight)))
		: CHART_DIMENSIONS.tin.height;
	const locale = options.locale || undefined;
	const axisLabels = {
		x: options.axisLabels?.x || xColumn,
		y: options.axisLabels?.y || yColumn,
		z: options.axisLabels?.z || zColumn,
	};

	return {
		fillMode,
		colorRenderingMode,
		gradientMin,
		gradientMax,
		gradientDistribution,
		colorRamp,
		showEdges,
		edgeColor,
		showPoints,
		pointRadius,
		showZLabels,
		showHull,
		hullColor,
		showIsolines,
		isolineMode,
		isolineCount,
		isolineStep,
		isolineColor,
		isolineWidth,
		showIsolineLabels,
		isolineLabelSize,
		isolineLabelColor,
		colorIsolinesByZ,
		isolineMinColor,
		isolineMaxColor,
		showThreshold,
		thresholdValue,
		thresholdColor,
		thresholdWidth,
		showXAxisLabel,
		showYAxisLabel,
		customTitle,
		chartHeight,
		locale,
		axisLabels,
		requestedSubdivisionDepth: options.subdivisionDepth,
	};
}
