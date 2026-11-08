/**
 * Pie-chart option normalization.
 *
 * Turns the stored chart config into a validated config object with every
 * layout-independent default and bound applied exactly once. The radius clamps
 * (inner/outer) depend on the rendered geometry and stay in `renderers/svg.js`; the
 * raw inner/outer values are passed through here. Mirrors the renderer's
 * historical semantics verbatim, including the raw (unvalidated)
 * `customSliceColors` pass-through. Pure: no DOM, no d3. Used by `renderers/svg.js`.
 */

import { CHART_COLORS, CHART_DIMENSIONS } from '../../config/charts/definitions.js';
import { PIE_CHART } from '../../config/charts/definitions/pie.js';
import { clamp } from '../../utils/formatters.js';
import { isValidHexColor } from '../../utils/colorUtils.js';

/**
 * Normalize the pie render config.
 *
 * @param {Object} config - Stored chart config.
 * @returns {Object} Validated config locals.
 */
export function normalizePieOptions(config) {
	const color = isValidHexColor(String(config.color || '').trim())
		? String(config.color).trim()
		: CHART_COLORS.pie;
	const customSliceColors = config.customSliceColors || {};
	// Read as given: chart config canonicalization checks the enumerated
	// settings against the chart's definition.
	const { measureMode, topNMode, labelPosition } = config;
	const topN = Number.isFinite(Number(config.topN)) ? Number(config.topN) : 0;
	const rawInner = Number(config.innerRadius);
	const rawOuter = Number(config.outerRadius);
	const rawPadAngle = Number(config.padAngle);
	const valueColumn = config.valueColumn || null;
	const showCategoryLabel = config.showCategoryLabel !== false;
	const showValueLabel = config.showValueLabel !== false;
	const showLegend = config.showLegend !== false;
	const customTitle = String(config.customTitle || '').trim().slice(0, 80);
	const chartHeight = Number.isFinite(Number(config.chartHeight))
		? clamp(Number(config.chartHeight), 220, 720)
		: CHART_DIMENSIONS.pie.height;
	const padAngleDeg = clamp(
		Number.isFinite(rawPadAngle) ? rawPadAngle : PIE_CHART.defaultPadAngle,
		PIE_CHART.minPadAngle,
		PIE_CHART.maxPadAngle
	);
	const padAngleRad = (padAngleDeg * Math.PI) / 180;
	const zoomScale = clamp(
		Number.isFinite(Number(config.zoomScale)) ? Number(config.zoomScale) : PIE_CHART.defaultZoomScale,
		PIE_CHART.minZoomScale,
		PIE_CHART.maxZoomScale
	);

	return {
		color,
		customSliceColors,
		topN,
		topNMode,
		rawInner,
		rawOuter,
		measureMode,
		valueColumn,
		showCategoryLabel,
		showValueLabel,
		showLegend,
		labelPosition,
		customTitle,
		chartHeight,
		padAngleRad,
		zoomScale,
	};
}
