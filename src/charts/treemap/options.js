/**
 * Treemap option normalization.
 *
 * Turns the stored chart config into a validated config object with every
 * default and bound applied exactly once. Mirrors the renderer's historical
 * semantics verbatim. Pure: no DOM, no d3. Used by `renderers/svg.js`.
 */

import { CHART_COLORS } from '../../config/charts/definitions.js';
import { TREEMAP_CHART } from '../../config/charts/definitions/treemap.js';
import { clamp } from '../../utils/formatters.js';
import { isValidHexColor } from '../../utils/colorUtils.js';

/**
 * Normalize the treemap render config.
 *
 * @param {Object} config - Stored chart config.
 * @returns {Object} Validated config locals.
 */
export function normalizeTreemapOptions(config) {
	// Read as given: chart config canonicalization checks the enumerated
	// settings against the chart's definition.
	const { measureMode, colorMode, colorScheme } = config;
	const valueColumn = config.valueColumn || null;
	const topN = Number.isFinite(Number(config.topN)) ? Number(config.topN) : TREEMAP_CHART.defaultTopN;
	const padding = Number.isFinite(Number(config.padding)) ? clamp(Number(config.padding), 1, 6) : TREEMAP_CHART.defaultPadding;
	const showLabels = config.showLabels !== false;
	const showValues = config.showValues !== false;
	const customTitle = String(config.customTitle || '').trim().slice(0, 80);
	const chartHeight = Number.isFinite(Number(config.chartHeight))
		? clamp(Number(config.chartHeight), 220, 720)
		: 380;
	const uniformColor = isValidHexColor(String(config.color || '').trim())
		? String(config.color).trim()
		: CHART_COLORS.treemap;

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
	};
}
