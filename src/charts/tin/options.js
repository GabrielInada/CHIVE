/**
 * TIN config normalization.
 *
 * Turns the stored chart config into a validated config object with every
 * default and bound applied exactly once. The enumerated settings (fill mode,
 * color ramp, gradient distribution, isoline mode) pass through as given: chart
 * config canonicalization checks them against the chart's definition. Pure: no
 * DOM, no d3. Used by `renderers/svg.js`.
 */

import { CHART_COLORS, CHART_DIMENSIONS } from '../../config/charts/definitions.js';
import { TIN_CHART } from '../../config/charts/definitions/tin.js';
import { isValidHexColor } from '../../utils/colorUtils.js';

function normalizeColor(value, fallback) {
	const v = String(value || '').trim();
	return isValidHexColor(v) ? v : fallback;
}

/**
 * Normalize the TIN render config into a validated config object. Mirrors the
 * renderer's historical semantics exactly. `requestedSubdivisionDepth` carries
 * the raw subdivision request verbatim; the data-dependent rounding and budget
 * clamp stay in `resolveSurfaceDepth` (it needs the triangle count). This is the
 * single place that reads `config.subdivisionDepth`.
 *
 * @param {Object} config - Stored chart config.
 * @returns {Object} Validated config locals.
 */
export function normalizeTinOptions(config) {
	// Read as given: chart config canonicalization checks the enumerated
	// settings against the chart's definition.
	const { fillMode, gradientDistribution, colorRamp, isolineMode } = config;
	const gradientMin = normalizeColor(config.gradientMinColor, CHART_COLORS.tin);
	const gradientMax = normalizeColor(config.gradientMaxColor, '#ffffff');
	const showEdges = config.showEdges !== false;
	const edgeColor = normalizeColor(config.edgeColor, TIN_CHART.defaultEdgeColor);
	const showPoints = config.showPoints !== false;
	const pointRadius = Number.isFinite(Number(config.pointRadius))
		? Math.max(1, Number(config.pointRadius))
		: TIN_CHART.defaultPointRadius;
	const showZLabels = config.showZLabels === true;
	const showHull = config.showHull === true;
	const hullColor = normalizeColor(config.hullColor, TIN_CHART.defaultHullColor);
	const showIsolines = config.showIsolines === true;
	const isolineCountRaw = Math.round(Number(config.isolineCount));
	const isolineCount = Number.isFinite(isolineCountRaw)
		? Math.max(TIN_CHART.minIsolineCount, Math.min(TIN_CHART.maxIsolineCount, isolineCountRaw))
		: TIN_CHART.defaultIsolineCount;
	const isolineStepRaw = Number(config.isolineStep);
	const isolineStep = Number.isFinite(isolineStepRaw) && isolineStepRaw > 0
		? isolineStepRaw
		: TIN_CHART.defaultIsolineStep;
	const isolineColor = normalizeColor(config.isolineColor, TIN_CHART.defaultIsolineColor);
	const isolineWidthRaw = Number(config.isolineWidth);
	const isolineWidth = Number.isFinite(isolineWidthRaw)
		? Math.max(TIN_CHART.minIsolineWidth, Math.min(TIN_CHART.maxIsolineWidth, isolineWidthRaw))
		: TIN_CHART.defaultIsolineWidth;
	const showIsolineLabels = config.showIsolineLabels === true;
	const isolineLabelSizeRaw = Math.round(Number(config.isolineLabelSize));
	const isolineLabelSize = Number.isFinite(isolineLabelSizeRaw)
		? Math.max(TIN_CHART.minIsolineLabelSize, Math.min(TIN_CHART.maxIsolineLabelSize, isolineLabelSizeRaw))
		: TIN_CHART.defaultIsolineLabelSize;
	const isolineLabelColor = normalizeColor(config.isolineLabelColor, TIN_CHART.defaultIsolineLabelColor);
	const colorIsolinesByZ = config.colorIsolinesByZ === true;
	const isolineMinColor = normalizeColor(config.isolineMinColor, TIN_CHART.defaultIsolineMinColor);
	const isolineMaxColor = normalizeColor(config.isolineMaxColor, TIN_CHART.defaultIsolineMaxColor);
	const showThreshold = config.showThreshold === true;
	const thresholdValueRaw = Number(config.thresholdValue);
	const thresholdValue = Number.isFinite(thresholdValueRaw)
		? thresholdValueRaw
		: TIN_CHART.defaultThresholdValue;
	const thresholdColor = normalizeColor(config.thresholdColor, TIN_CHART.defaultThresholdColor);
	const thresholdWidthRaw = Number(config.thresholdWidth);
	const thresholdWidth = Number.isFinite(thresholdWidthRaw)
		? Math.max(TIN_CHART.minThresholdWidth, Math.min(TIN_CHART.maxThresholdWidth, thresholdWidthRaw))
		: TIN_CHART.defaultThresholdWidth;
	const showXAxisLabel = config.showXAxisLabel !== false;
	const showYAxisLabel = config.showYAxisLabel !== false;
	const customTitle = String(config.customTitle || '').trim().slice(0, 80);
	const chartHeight = Number.isFinite(Number(config.chartHeight))
		? Math.max(220, Math.min(900, Number(config.chartHeight)))
		: CHART_DIMENSIONS.tin.height;

	return {
		fillMode,
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
		requestedSubdivisionDepth: config.subdivisionDepth,
	};
}
