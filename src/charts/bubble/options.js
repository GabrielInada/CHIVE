/** Pure normalization of stored bubble config. Labels and callbacks belong to presentation. */

import { BUBBLE_CHART } from '../../config/charts/definitions/bubble.js';
import { CHART_DIMENSIONS } from '../../config/charts/definitions.js';
import { resolveNestingColumns } from './data.js';

/**
 * @param {Object} config - Stored chart config.
 * @returns {Object} Normalized drawing values.
 */
export function normalizeBubbleOptions(config) {
	// Read as given: chart config canonicalization checks the enumerated
	// settings against the chart's definition.
	const { measureMode, labelMode, nestingMode, colorScheme } = config;
	const valueColumn = config.valueColumn || null;
	const topN = Number.isFinite(Number(config.topN)) ? Number(config.topN) : BUBBLE_CHART.defaultTopN;
	const padding = Number.isFinite(Number(config.padding))
		? Number(config.padding)
		: BUBBLE_CHART.defaultPadding;
	const autoLabelMinRadius = Number.isFinite(Number(config.autoLabelMinRadius))
		? Number(config.autoLabelMinRadius)
		: BUBBLE_CHART.autoLabelMinRadius;
	const nestingColumns = resolveNestingColumns(config);
	const customTitle = String(config.customTitle || '').trim().slice(0, 80);
	const chartHeight = Number.isFinite(Number(config.chartHeight))
		? Math.max(400, Math.min(900, Number(config.chartHeight)))
		: CHART_DIMENSIONS.bubble.height;
	const zoomDuration = Number.isFinite(Number(config.zoomTransitionDuration))
		? Number(config.zoomTransitionDuration)
		: BUBBLE_CHART.zoomTransitionDuration;
	return {
		measureMode, labelMode, nestingMode, colorScheme, valueColumn, topN, padding,
		autoLabelMinRadius, nestingColumns, customTitle, chartHeight, zoomDuration,
	};
}
