/**
 * Scatter-plot option normalization.
 *
 * Turns the stored chart config into a validated config object with every
 * default and bound applied exactly once. Pure: no DOM, no d3. Used by
 * `renderers/svg.js`.
 */

import { SCATTER_PLOT } from '../../config/charts/definitions/scatter.js';
import { CHART_DIMENSIONS, CHART_COLORS } from '../../config/charts/definitions.js';
import { isValidHexColor } from '../../utils/colorUtils.js';

/**
 * Normalize the scatter render config. Mirrors the renderer's historical
 * semantics exactly: `radius`/`opacity` fall back to defaults only when
 * non-finite (no range clamp); `sizeMin` floors at 0.5, `sizeMax` floors at
 * `sizeMin`; `chartHeight` clamps to 220-720; colors validate through
 * `isValidHexColor`; the title trims to 80 chars. The enumerated settings
 * (scales, size, color and categorical-pair modes, gradient distribution and
 * palette) pass through as given. Text, column types and render-budget
 * approval arrive separately from presentation.
 *
 * @param {Object} config - Stored chart config.
 * @returns {Object} Validated config locals.
 */
export function normalizeScatterOptions(config) {
	// Read as given: chart config canonicalization checks the enumerated
	// settings against the chart's definition.
	const {
		xScale: xScaleType,
		yScale: yScaleType,
		sizeMode,
		categoricalPairMode,
		colorMode,
		gradientDistribution,
		colorScheme,
	} = config;
	const showXAxisLabel = config.showXAxisLabel !== false;
	const showYAxisLabel = config.showYAxisLabel !== false;
	const radius = Number.isFinite(Number(config.radius)) ? Number(config.radius) : SCATTER_PLOT.defaultRadius;
	const opacity = Number.isFinite(Number(config.opacity)) ? Number(config.opacity) : SCATTER_PLOT.defaultOpacity;
	const sizeField = config.sizeField || null;
	const sizeMin = Number.isFinite(Number(config.sizeMin)) ? Math.max(0.5, Number(config.sizeMin)) : 2;
	const sizeMax = Number.isFinite(Number(config.sizeMax)) ? Math.max(sizeMin, Number(config.sizeMax)) : 12;
	const color = isValidHexColor(String(config.color || '').trim())
		? String(config.color).trim()
		: CHART_COLORS.scatter;
	const colorField = config.colorField || null;
	const gradientMinColor = isValidHexColor(String(config.gradientMinColor || '').trim())
		? String(config.gradientMinColor).trim()
		: color;
	const gradientMaxColor = isValidHexColor(String(config.gradientMaxColor || '').trim())
		? String(config.gradientMaxColor).trim()
		: '#ffffff';
	const customTitle = String(config.customTitle || '').trim().slice(0, 80);
	const chartHeight = Number.isFinite(Number(config.chartHeight))
		? Math.max(220, Math.min(720, Number(config.chartHeight)))
		: CHART_DIMENSIONS.scatter.height;

	return {
		xScaleType,
		yScaleType,
		showXAxisLabel,
		showYAxisLabel,
		radius,
		opacity,
		sizeMode,
		sizeField,
		sizeMin,
		sizeMax,
		color,
		colorMode,
		colorField,
		gradientMinColor,
		gradientMaxColor,
		colorScheme,
		gradientDistribution,
		customTitle,
		chartHeight,
		categoricalPairMode,
	};
}
