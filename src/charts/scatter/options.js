/**
 * Scatter-plot option normalization.
 *
 * Turns the raw render options bag into a validated config object with every
 * default and bound applied exactly once. Pure: no DOM, no d3. Used by
 * `renderers/svg.js`.
 */

import { SCATTER_PLOT } from '../../config/charts/definitions/scatter.js';
import { CHART_DIMENSIONS, CHART_COLORS } from '../../config/charts/definitions.js';
import { isValidHexColor } from '../../utils/colorUtils.js';
import { resolveScatterColorScheme } from './palettes.js';

/**
 * Normalize the scatter render options. Mirrors the renderer's historical
 * semantics exactly: `radius`/`opacity` fall back to defaults only when
 * non-finite (no range clamp); `sizeMin` floors at 0.5, `sizeMax` floors at
 * `sizeMin`; `chartHeight` clamps to 220-720; colors validate through
 * `isValidHexColor`; `colorMode`/`categoricalPairMode` collapse to their
 * enums; the title trims to 80 chars. `xFilterColumn`/`yFilterColumn` come
 * from the options bag's `xColumn`/`yColumn` (the click-to-filter column
 * names), distinct from the positional data columns.
 *
 * @param {Object} options - Raw render options.
 * @param {string} xColumn - Positional x data column (for the default x label).
 * @param {string} yColumn - Positional y data column (for the default y label).
 * @returns {Object} Validated config locals.
 */
export function normalizeScatterOptions(options, xColumn, yColumn) {
	const xScaleType = options.xScale === 'log' ? 'log' : 'linear';
	const yScaleType = options.yScale === 'log' ? 'log' : 'linear';
	const showXAxisLabel = options.showXAxisLabel !== false;
	const showYAxisLabel = options.showYAxisLabel !== false;
	const radius = Number.isFinite(Number(options.radius)) ? Number(options.radius) : SCATTER_PLOT.defaultRadius;
	const opacity = Number.isFinite(Number(options.opacity)) ? Number(options.opacity) : SCATTER_PLOT.defaultOpacity;
	const sizeMode = options.sizeMode === 'numeric' ? 'numeric' : 'uniform';
	const sizeField = options.sizeField || null;
	const sizeMin = Number.isFinite(Number(options.sizeMin)) ? Math.max(0.5, Number(options.sizeMin)) : 2;
	const sizeMax = Number.isFinite(Number(options.sizeMax)) ? Math.max(sizeMin, Number(options.sizeMax)) : 12;
	const color = isValidHexColor(String(options.color || '').trim())
		? String(options.color).trim()
		: CHART_COLORS.scatter;
	const colorMode = ['uniform', 'numeric', 'category'].includes(options.colorMode)
		? options.colorMode
		: 'uniform';
	const colorField = options.colorField || null;
	const gradientMinColor = isValidHexColor(String(options.gradientMinColor || '').trim())
		? String(options.gradientMinColor).trim()
		: color;
	const gradientMaxColor = isValidHexColor(String(options.gradientMaxColor || '').trim())
		? String(options.gradientMaxColor).trim()
		: '#ffffff';
	const colorScheme = resolveScatterColorScheme(options.colorScheme);
	const gradientDistribution = options.gradientDistribution === 'rank' ? 'rank' : 'value';
	const customTitle = String(options.customTitle || '').trim().slice(0, 80);
	const chartHeight = Number.isFinite(Number(options.chartHeight))
		? Math.max(220, Math.min(720, Number(options.chartHeight)))
		: CHART_DIMENSIONS.scatter.height;
	const categoricalPairMode = options.categoricalPairMode === 'aggregate' ? 'aggregate' : 'jitter';
	const labels = {
		xAxis: options.labels?.xAxis || 'X',
		yAxis: options.labels?.yAxis || 'Y',
		index: options.labels?.index || 'Index',
		count: options.labels?.count || 'Count',
		regressionSlope: options.labels?.regressionSlope || 'Slope',
		regressionIntercept: options.labels?.regressionIntercept || 'Intercept',
		regressionR2: options.labels?.regressionR2 || 'R²',
		regressionN: options.labels?.regressionN || 'Points',
		regressionGroup: options.labels?.regressionGroup || 'Group',
	};
	const axisLabels = {
		x: options.axisLabels?.x || xColumn,
		y: options.axisLabels?.y || yColumn,
	};
	const locale = options.locale || undefined;
	const configuredAxisTypes = {
		x: options.axisTypes?.x,
		y: options.axisTypes?.y,
	};
	const xFilterColumn = typeof options.xColumn === 'string' ? options.xColumn : null;
	const yFilterColumn = typeof options.yColumn === 'string' ? options.yColumn : null;
	const allowFullRender = options.allowFullRender === true;

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
		labels,
		axisLabels,
		locale,
		configuredAxisTypes,
		xFilterColumn,
		yFilterColumn,
		allowFullRender,
	};
}
