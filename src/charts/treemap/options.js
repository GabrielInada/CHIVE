/**
 * Treemap option normalization.
 *
 * Turns the raw render options bag into a validated config object with every
 * default and bound applied exactly once. Mirrors the renderer's historical
 * semantics verbatim. Pure: no DOM, no d3. Used by `renderers/svg.js`.
 */

import { CHART_COLORS, TREEMAP_CHART } from '../../config/charts.js';
import { clamp } from '../../utils/formatters.js';
import { isValidHexColor } from '../../utils/colorUtils.js';

/**
 * Normalize the treemap render options.
 *
 * @param {Object} options - Raw render options.
 * @returns {Object} Validated config locals.
 */
export function normalizeTreemapOptions(options) {
	const measureMode = TREEMAP_CHART.measureModes.includes(options.measureMode)
		? options.measureMode
		: TREEMAP_CHART.defaultMeasureMode;
	const valueColumn = options.valueColumn || null;
	const topN = Number.isFinite(Number(options.topN)) ? Number(options.topN) : TREEMAP_CHART.defaultTopN;
	const padding = Number.isFinite(Number(options.padding)) ? clamp(Number(options.padding), 1, 6) : TREEMAP_CHART.defaultPadding;
	const showLabels = options.showLabels !== false;
	const showValues = options.showValues !== false;
	const customTitle = String(options.customTitle || '').trim().slice(0, 80);
	const chartHeight = Number.isFinite(Number(options.chartHeight))
		? clamp(Number(options.chartHeight), 220, 720)
		: 380;
	const colorMode = options.colorMode || 'scheme';
	const colorScheme = options.colorScheme || 'Bold';
	const uniformColor = isValidHexColor(String(options.color || '').trim())
		? String(options.color).trim()
		: CHART_COLORS.treemap;
	const locale = options.locale || undefined;
	const labels = {
		category: options.labels?.category || 'Category',
		count: options.labels?.count || 'Count',
		sum: options.labels?.sum || 'Sum',
		percentage: options.labels?.percentage || 'Percentage',
		focusOnThis: options.labels?.focusOnThis || 'Show only this',
		addToFilter: options.labels?.addToFilter || 'Add to global filter',
	};

	return {
		measureMode,
		valueColumn,
		topN,
		padding,
		showLabels,
		showValues,
		customTitle,
		chartHeight,
		colorMode,
		colorScheme,
		uniformColor,
		locale,
		labels,
	};
}
