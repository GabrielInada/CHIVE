/**
 * Bar-chart option normalization.
 *
 * Turns the raw render options bag into a validated config object with every
 * default and bound applied exactly once. Mirrors the renderer's historical
 * semantics verbatim. Pure: no DOM, no d3. Used by `renderers/svg.js`.
 */

import { BAR_CHART } from '../../config/charts/definitions/bar.js';
import { CHART_DIMENSIONS, CHART_COLORS } from '../../config/charts/definitions.js';
import { isValidHexColor } from '../../utils/colorUtils.js';

/**
 * Normalize the bar render options.
 *
 * @param {Object} options - Raw render options.
 * @param {string} categoryColumn - Category column name (for the default x label).
 * @returns {Object} Validated config locals.
 */
export function normalizeBarOptions(options, categoryColumn) {
	// Read as given: chart config canonicalization checks the enumerated
	// settings against the chart's definition.
	const { sort, measureMode, colorMode, gradientDistribution } = options;
	const topN = Number.isFinite(Number(options.topN)) ? Number(options.topN) : BAR_CHART.defaultTopN;
	const showXAxisLabel = options.showXAxisLabel !== false;
	const showYAxisLabel = options.showYAxisLabel !== false;
	const labels = {
		close: options.labels?.close,
		category: options.labels?.category || 'Category',
		measure: options.labels?.measure || 'Value',
		percentage: options.labels?.percentage || 'Percentage',
		missing: options.labels?.missing || '(missing)',
	};
	const valueColumn = options.valueColumn || null;
	const axisLabels = {
		x: options.axisLabels?.x || categoryColumn,
		y: options.axisLabels?.y || labels.measure,
	};
	const color = isValidHexColor(String(options.color || '').trim())
		? String(options.color).trim()
		: CHART_COLORS.bar;
	const gradientMinColor = isValidHexColor(String(options.gradientMinColor || '').trim())
		? String(options.gradientMinColor).trim()
		: color;
	const gradientMaxColor = isValidHexColor(String(options.gradientMaxColor || '').trim())
		? String(options.gradientMaxColor).trim()
		: '#ffffff';
	const manualThresholdPct = Number.isFinite(Number(options.manualThresholdPct))
		? Math.max(0, Math.min(100, Number(options.manualThresholdPct)))
		: 50;
	const customTitle = String(options.customTitle || '').trim().slice(0, 80);
	const chartHeight = Number.isFinite(Number(options.chartHeight))
		? Math.max(220, Math.min(720, Number(options.chartHeight)))
		: CHART_DIMENSIONS.bar.height;
	const locale = options.locale || undefined;

	return {
		sort,
		topN,
		showXAxisLabel,
		showYAxisLabel,
		labels,
		measureMode,
		valueColumn,
		axisLabels,
		color,
		colorMode,
		gradientMinColor,
		gradientMaxColor,
		manualThresholdPct,
		gradientDistribution,
		customTitle,
		chartHeight,
		locale,
	};
}
