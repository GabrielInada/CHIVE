/**
 * Bar-chart option normalization.
 *
 * Turns the stored chart config into a validated config object with every
 * default and bound applied exactly once. Mirrors the renderer's historical
 * semantics verbatim. Pure: no DOM, no d3. Used by `renderers/svg.js`.
 */

import { BAR_CHART } from '../../config/charts/definitions/bar.js';
import { CHART_DIMENSIONS, CHART_COLORS } from '../../config/charts/definitions.js';
import { isValidHexColor } from '../../utils/colorUtils.js';

/**
 * Normalize the bar render config.
 *
 * @param {Object} config - Stored chart config.
 * @returns {Object} Validated config locals.
 */
export function normalizeBarOptions(config) {
	// Read as given: chart config canonicalization checks the enumerated
	// settings against the chart's definition.
	const { sort, measureMode, colorMode, gradientDistribution } = config;
	const topN = Number.isFinite(Number(config.topN)) ? Number(config.topN) : BAR_CHART.defaultTopN;
	const showXAxisLabel = config.showXAxisLabel !== false;
	const showYAxisLabel = config.showYAxisLabel !== false;
	const valueColumn = config.valueColumn || null;
	const color = isValidHexColor(String(config.color || '').trim())
		? String(config.color).trim()
		: CHART_COLORS.bar;
	const gradientMinColor = isValidHexColor(String(config.gradientMinColor || '').trim())
		? String(config.gradientMinColor).trim()
		: color;
	const gradientMaxColor = isValidHexColor(String(config.gradientMaxColor || '').trim())
		? String(config.gradientMaxColor).trim()
		: '#ffffff';
	const manualThresholdPct = Number.isFinite(Number(config.manualThresholdPct))
		? Math.max(0, Math.min(100, Number(config.manualThresholdPct)))
		: 50;
	const customTitle = String(config.customTitle || '').trim().slice(0, 80);
	const chartHeight = Number.isFinite(Number(config.chartHeight))
		? Math.max(220, Math.min(720, Number(config.chartHeight)))
		: CHART_DIMENSIONS.bar.height;

	return {
		sort,
		topN,
		showXAxisLabel,
		showYAxisLabel,
		measureMode,
		valueColumn,
		color,
		colorMode,
		gradientMinColor,
		gradientMaxColor,
		manualThresholdPct,
		gradientDistribution,
		customTitle,
		chartHeight,
	};
}
