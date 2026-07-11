/**
 * Pie-chart option normalization.
 *
 * Turns the raw render options bag into a validated config object with every
 * layout-independent default and bound applied exactly once. The radius clamps
 * (inner/outer) depend on the rendered geometry and stay in `renderers/svg.js`; the
 * raw inner/outer values are passed through here. Mirrors the renderer's
 * historical semantics verbatim, including the raw (unvalidated)
 * `customSliceColors` pass-through. Pure: no DOM, no d3. Used by `renderers/svg.js`.
 */

import { CHART_COLORS, CHART_DIMENSIONS, PIE_CHART } from '../../config/charts.js';
import { clamp } from '../../utils/formatters.js';
import { isValidHexColor } from '../../utils/colorUtils.js';

/**
 * Normalize the pie render options.
 *
 * @param {Object} options - Raw render options.
 * @returns {Object} Validated config locals.
 */
export function normalizePieOptions(options) {
	const color = isValidHexColor(String(options.color || '').trim())
		? String(options.color).trim()
		: CHART_COLORS.pie;
	const locale = options.locale || undefined;
	const customSliceColors = options.customSliceColors || {};
	const labels = {
		category: options.labels?.category || 'Category',
		count: options.labels?.count || 'Count',
		percentage: options.labels?.percentage || 'Percentage',
		other: options.labels?.other || 'Other',
		focusOnThis: options.labels?.focusOnThis || 'Show only this',
		addToFilter: options.labels?.addToFilter || 'Add to global filter',
	};
	const topN = Number.isFinite(Number(options.topN)) ? Number(options.topN) : 0;
	const topNMode = options.topNMode === 'truncate' ? 'truncate' : 'other';
	const rawInner = Number(options.innerRadius);
	const rawOuter = Number(options.outerRadius);
	const rawPadAngle = Number(options.padAngle);
	const measureMode = options.measureMode === 'sum' ? 'sum' : 'count';
	const valueColumn = options.valueColumn || null;
	const showCategoryLabel = options.showCategoryLabel !== false;
	const showValueLabel = options.showValueLabel !== false;
	const showLegend = options.showLegend !== false;
	const labelPosition = options.labelPosition === 'outside' ? 'outside' : 'inside';
	const customTitle = String(options.customTitle || '').trim().slice(0, 80);
	const chartHeight = Number.isFinite(Number(options.chartHeight))
		? clamp(Number(options.chartHeight), 220, 720)
		: CHART_DIMENSIONS.pie.height;
	const padAngleDeg = clamp(
		Number.isFinite(rawPadAngle) ? rawPadAngle : PIE_CHART.defaultPadAngle,
		PIE_CHART.minPadAngle,
		PIE_CHART.maxPadAngle
	);
	const padAngleRad = (padAngleDeg * Math.PI) / 180;
	const zoomScale = clamp(
		Number.isFinite(Number(options.zoomScale)) ? Number(options.zoomScale) : PIE_CHART.defaultZoomScale,
		PIE_CHART.minZoomScale,
		PIE_CHART.maxZoomScale
	);

	return {
		color,
		locale,
		customSliceColors,
		labels,
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
