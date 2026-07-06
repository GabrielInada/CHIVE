/**
 * Bar-chart option normalization.
 *
 * Turns the raw render options bag into a validated config object with every
 * default and bound applied exactly once. Mirrors the renderer's historical
 * semantics verbatim. Pure: no DOM, no d3. Used by `barChart.js`.
 */

import { BAR_CHART, CHART_DIMENSIONS, CHART_COLORS } from '../../../config/charts.js';
import { isValidHexColor } from '../../../utils/colorUtils.js';

/**
 * Normalize the bar render options.
 *
 * @param {Object} options - Raw render options.
 * @param {string} categoryColumn - Category column name (for the default x label).
 * @returns {Object} Validated config locals.
 */
export function normalizeBarOptions(options, categoryColumn) {
	const sort = options.sort || BAR_CHART.defaultSort;
	const topN = Number.isFinite(Number(options.topN)) ? Number(options.topN) : BAR_CHART.defaultTopN;
	const showXAxisLabel = options.showXAxisLabel !== false;
	const showYAxisLabel = options.showYAxisLabel !== false;
	const labels = {
		category: options.labels?.category || 'Category',
		count: options.labels?.count || 'Count',
		sum: options.labels?.sum || 'Sum',
		mean: options.labels?.mean || 'Mean',
		percentage: options.labels?.percentage || 'Percentage',
		focusOnThis: options.labels?.focusOnThis || 'Show only this',
		addToFilter: options.labels?.addToFilter || 'Add to global filter',
	};
	const measureMode = BAR_CHART.measureModes.includes(options.measureMode)
		? options.measureMode
		: BAR_CHART.defaultMeasureMode;
	const valueColumn = options.valueColumn || null;
	const axisLabels = {
		x: options.axisLabels?.x || categoryColumn,
		y: options.axisLabels?.y
			|| (measureMode === 'mean'
				? labels.mean
				: measureMode === 'sum'
					? labels.sum
					: labels.count),
	};
	const color = isValidHexColor(String(options.color || '').trim())
		? String(options.color).trim()
		: CHART_COLORS.bar;
	const colorMode = ['uniform', 'gradient', 'gradient-manual'].includes(options.colorMode)
		? options.colorMode
		: 'uniform';
	const gradientMinColor = isValidHexColor(String(options.gradientMinColor || '').trim())
		? String(options.gradientMinColor).trim()
		: color;
	const gradientMaxColor = isValidHexColor(String(options.gradientMaxColor || '').trim())
		? String(options.gradientMaxColor).trim()
		: '#ffffff';
	const manualThresholdPct = Number.isFinite(Number(options.manualThresholdPct))
		? Math.max(0, Math.min(100, Number(options.manualThresholdPct)))
		: 50;
	const gradientDistribution = options.gradientDistribution === 'rank' ? 'rank' : 'value';
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
