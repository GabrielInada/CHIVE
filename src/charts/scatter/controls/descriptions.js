/**
 * Scatter controls: the sidebar sections, each control declared once.
 *
 * Data & Aggregation (X and Y columns, their scales, how two categorical axes
 * pair up), Display (axis labels, title), the regression section (line,
 * per-category mode, confidence band, equation, R²) and Styling (marker
 * radius and opacity, the size encoding, the color mode and field, the
 * uniform and gradient colors, the gradient distribution or category palette,
 * and the palette buttons). The shared `buildDescribedControls` builds and
 * wires them.
 *
 * Several controls keep the others consistent: an axis that turns
 * categorical resets its scale to linear, the color mode keeps a color field
 * the new mode can use, editing the point color colors the points uniformly,
 * and per-category regression colors the points by the first categorical
 * column while nothing colors them by a category yet.
 *
 * @typedef {import('../../../types.js').ChartControlDescriptions} ChartControlDescriptions
 * @typedef {import('../../../types.js').ChartControlContext} ChartControlContext
 * @typedef {import('../../../types.js').ControlDescription} ControlDescription
 */

import { CHART_COLORS } from '../../../config/charts/definitions.js';
import { SCATTER_DEFINITION, SCATTER_PLOT } from '../../../config/charts/definitions/scatter.js';
import { findAppliedColorPreset } from '../../shared/controls/factories.js';

// The light end of the gradient, written in place of an invalid color.
const GRADIENT_MAX_FALLBACK = '#ffffff';

/**
 * The columns the scatter treats as categorical: every visible column that is
 * not numeric, dates included.
 *
 * @param {ChartControlContext} context
 * @returns {string[]}
 */
function categoricalColumns(context) {
	return context.allColumns.filter(column => !context.numeric.includes(column));
}

const isNumeric = (column, context) => context.numeric.includes(column);
const bothAxesNumeric = (config, context) => Boolean(config.x && config.y && isNumeric(config.x, context) && isNumeric(config.y, context));
const bothAxesCategorical = (config, context) => Boolean(config.x && config.y && !isNumeric(config.x, context) && !isNumeric(config.y, context));
const regressionOff = config => config.regression?.enabled !== true;

/**
 * An axis select: "None" and every visible column. Picking a column that is
 * not numeric resets the axis scale to linear, since a log scale needs numbers.
 *
 * @param {{ id: string, key: string, scaleKey: string, label: string }} options
 * @returns {ControlDescription}
 */
function axisControl({ id, key, scaleKey, label }) {
	return {
		widget: 'select',
		id,
		key,
		label,
		columns: context => context.allColumns,
		toValue: (value, { context }) => (context.allColumns.includes(value) ? value : null),
		toPatch: (column, { config, context }) => ({
			[key]: column,
			[scaleKey]: isNumeric(column, context) ? config[scaleKey] : 'linear',
		}),
	};
}

/**
 * An axis scale select, disabled while its axis is not a numeric column. A
 * scale chosen then is stored as linear.
 *
 * @param {{ id: string, key: string, axisKey: string, label: string }} options
 * @returns {ControlDescription}
 */
function scaleControl({ id, key, axisKey, label }) {
	return {
		widget: 'select',
		id,
		key,
		label,
		optionLabels: { linear: 'chive-chart-scale-linear', log: 'chive-chart-scale-log' },
		disabledWhen: (config, context) => !isNumeric(config[axisKey], context),
		toValue: (scale, { config, context }) => (isNumeric(config[axisKey], context) ? scale : 'linear'),
	};
}

/**
 * A regression display toggle, on unless it is turned off, and disabled while
 * the regression is off.
 *
 * @param {{ id: string, setting: string, label: string }} options
 * @returns {ControlDescription}
 */
function regressionToggle({ id, setting, label }) {
	return {
		widget: 'checkbox',
		id,
		key: `regression.${setting}`,
		label,
		value: config => config.regression?.[setting] !== false,
		disabledWhen: regressionOff,
	};
}

/**
 * The coloring per-category regression needs: none while the points are
 * colored by a category field, otherwise category coloring by the first
 * categorical column, when there is one.
 *
 * @param {Object} config
 * @param {ChartControlContext} context
 * @returns {Object} A patch, empty when the coloring stays.
 */
function categoryColoring(config, context) {
	if (config.colorMode === 'category' && config.colorField) return {};
	const [column] = categoricalColumns(context);
	return column ? { colorMode: 'category', colorField: column, colorFieldType: 'category' } : {};
}

/** @type {ChartControlDescriptions} */
export const SCATTER_CONTROLS = Object.freeze({
	definition: SCATTER_DEFINITION,
	sections: Object.freeze([
		{
			id: 'data',
			title: 'Data & Aggregation',
			expanded: true,
			icon: 'data',
			controls: [
				axisControl({ id: 'viz-select-x', key: 'x', scaleKey: 'xScale', label: 'chive-chart-control-scatter-x' }),
				axisControl({ id: 'viz-select-y', key: 'y', scaleKey: 'yScale', label: 'chive-chart-control-scatter-y' }),
				scaleControl({ id: 'viz-select-scatter-xscale', key: 'xScale', axisKey: 'x', label: 'chive-chart-control-scatter-xscale' }),
				scaleControl({ id: 'viz-select-scatter-yscale', key: 'yScale', axisKey: 'y', label: 'chive-chart-control-scatter-yscale' }),
				{
					widget: 'select',
					id: 'viz-select-scatter-categorical-mode',
					key: 'categoricalPairMode',
					label: 'chive-chart-control-scatter-categorical-mode',
					optionLabels: {
						jitter: 'chive-chart-control-scatter-categorical-mode-jitter',
						aggregate: 'chive-chart-control-scatter-categorical-mode-aggregate',
					},
					// Only two categorical axes need pairing.
					disabledWhen: (config, context) => !bothAxesCategorical(config, context),
				},
			],
		},
		{
			id: 'display',
			title: 'Display',
			expanded: true,
			icon: 'display',
			controls: [
				{
					widget: 'checkbox',
					id: 'viz-toggle-scatter-x-label',
					key: 'showXAxisLabel',
					label: 'chive-chart-control-axis-label-x',
				},
				{
					widget: 'checkbox',
					id: 'viz-toggle-scatter-y-label',
					key: 'showYAxisLabel',
					label: 'chive-chart-control-axis-label-y',
				},
				{
					widget: 'text',
					id: 'viz-input-scatter-title',
					key: 'customTitle',
					label: 'chive-chart-control-common-title',
				},
			],
		},
		{
			id: 'analytics',
			titleKey: 'chive-chart-control-scatter-regression-section',
			expanded: false,
			icon: 'advanced',
			controls: [
				{
					widget: 'checkbox',
					id: 'viz-toggle-scatter-regression-enabled',
					key: 'regression.enabled',
					label: 'chive-chart-control-scatter-regression-enabled',
					// A regression line needs two numeric axes.
					disabledWhen: (config, context) => !bothAxesNumeric(config, context),
				},
				{
					widget: 'select',
					id: 'viz-select-scatter-regression-mode',
					key: 'regression.mode',
					label: 'chive-chart-control-scatter-regression-mode',
					optionLabels: {
						overall: 'chive-chart-control-scatter-regression-mode-overall',
						perCategory: 'chive-chart-control-scatter-regression-mode-per-category',
					},
					disabledWhen: (config, context) => regressionOff(config) || categoricalColumns(context).length === 0,
					toPatch: (mode, { config, context }) => ({
						regression: { ...(config.regression || {}), mode },
						...(mode === 'perCategory' ? categoryColoring(config, context) : {}),
					}),
				},
				regressionToggle({ id: 'viz-toggle-scatter-regression-ci', setting: 'showCI', label: 'chive-chart-control-scatter-regression-show-ci' }),
				regressionToggle({ id: 'viz-toggle-scatter-regression-equation', setting: 'showEquation', label: 'chive-chart-control-scatter-regression-show-equation' }),
				regressionToggle({ id: 'viz-toggle-scatter-regression-r2', setting: 'showR2', label: 'chive-chart-control-scatter-regression-show-r2' }),
			],
		},
		{
			id: 'styling',
			title: 'Styling',
			expanded: false,
			icon: 'styling',
			controls: [
				{
					widget: 'select',
					id: 'viz-select-scatter-radius',
					key: 'radius',
					label: 'chive-chart-control-scatter-radius',
					options: () => SCATTER_PLOT.radiusOptions.map(radius => ({ value: String(radius), label: String(radius) })),
					toValue: Number,
				},
				{
					widget: 'select',
					id: 'viz-select-scatter-opacity',
					key: 'opacity',
					label: 'chive-chart-control-scatter-opacity',
					options: () => SCATTER_PLOT.opacityOptions.map(opacity => ({ value: String(opacity), label: `${Math.round(opacity * 100)}%` })),
					toValue: Number,
				},
				{
					widget: 'select',
					id: 'viz-select-scatter-size-mode',
					key: 'sizeMode',
					label: 'chive-chart-control-scatter-size-mode',
					optionLabels: { uniform: 'chive-chart-size-uniform', numeric: 'chive-chart-size-numeric' },
				},
				{
					widget: 'select',
					id: 'viz-select-scatter-size-field',
					key: 'sizeField',
					label: 'chive-chart-control-scatter-size-field',
					columns: context => context.numeric,
					disabledWhen: config => config.sizeMode !== 'numeric',
					// A forged option cannot store a column that is not numeric.
					toValue: (value, { context }) => (context.numeric.includes(value) ? value : null),
				},
				{
					widget: 'slider',
					id: 'viz-slider-scatter-size-min',
					key: 'sizeMin',
					label: 'chive-chart-control-scatter-size-min',
					min: 1,
					max: 10,
					step: 1,
					value: config => config.sizeMin || 2,
					disabledWhen: config => config.sizeMode !== 'numeric',
				},
				{
					widget: 'slider',
					id: 'viz-slider-scatter-size-max',
					key: 'sizeMax',
					label: 'chive-chart-control-scatter-size-max',
					min: 5,
					max: 30,
					step: 1,
					value: config => config.sizeMax || 12,
					disabledWhen: config => config.sizeMode !== 'numeric',
				},
				{
					widget: 'select',
					id: 'viz-select-scatter-color-mode',
					key: 'colorMode',
					label: 'chive-chart-color-mode',
					optionLabels: {
						uniform: 'chive-chart-color-uniform',
						numeric: 'chive-chart-color-scatter-numeric',
						category: 'chive-chart-color-scatter-category',
					},
					toPatch: (colorMode, { config, context }) => {
						const fields = colorMode === 'category' ? categoricalColumns(context) : context.numeric;
						const regression = config.regression || {};
						return {
							colorMode,
							// Keep the color field while the new mode can use it.
							colorField: colorMode === 'uniform'
								? null
								: (fields.includes(config.colorField) ? config.colorField : (fields[0] || null)),
							colorFieldType: colorMode === 'category' ? 'category' : (colorMode === 'numeric' ? 'numeric' : null),
							// Per-category regression needs category coloring.
							regression: { ...regression, mode: colorMode === 'category' ? regression.mode : 'overall' },
						};
					},
				},
				{
					widget: 'select',
					id: 'viz-select-scatter-color-field',
					key: 'colorField',
					label: 'chive-chart-color-scatter-field',
					// Category coloring takes a categorical column, the other modes a numeric one.
					columns: (context, config) => (config.colorMode === 'category' ? categoricalColumns(context) : context.numeric),
					disabledWhen: config => config.colorMode === 'uniform',
					toValue: value => value || null,
				},
				{
					widget: 'color',
					id: 'viz-input-scatter-color',
					key: 'color',
					label: 'chive-chart-control-scatter-color',
					fallback: CHART_COLORS.scatter,
					disabledWhen: config => config.colorMode !== 'uniform',
					// Editing the point color colors the points uniformly.
					toPatch: color => ({ colorMode: 'uniform', colorField: null, colorFieldType: null, color }),
				},
				{
					widget: 'color',
					id: 'viz-input-scatter-gradient-min',
					key: 'gradientMinColor',
					label: 'chive-chart-color-gradient-min',
					fallback: CHART_COLORS.scatter,
					disabledWhen: config => config.colorMode === 'uniform',
				},
				{
					widget: 'color',
					id: 'viz-input-scatter-gradient-max',
					key: 'gradientMaxColor',
					label: 'chive-chart-color-gradient-max',
					fallback: GRADIENT_MAX_FALLBACK,
					disabledWhen: config => config.colorMode === 'uniform',
				},
				{
					widget: 'select',
					id: 'viz-select-scatter-gradient-distribution',
					key: 'gradientDistribution',
					label: 'chive-chart-color-gradient-distribution',
					optionLabels: {
						value: 'chive-chart-color-gradient-distribution-value',
						rank: 'chive-chart-color-gradient-distribution-rank',
					},
					shownWhen: config => config.colorMode === 'numeric',
				},
				{
					widget: 'select',
					id: 'viz-select-scatter-color-scheme',
					key: 'colorScheme',
					label: 'chive-chart-color-scheme',
					// The palettes show their own names.
					optionText: name => name,
					shownWhen: config => config.colorMode === 'category',
				},
				{
					widget: 'palette',
					id: 'viz-scatter-color-preset',
					key: 'colorScheme',
					label: 'chive-chart-color-palette',
					colorKeys: SCATTER_PLOT.presetColorKeys,
					fallbacks: {
						color: CHART_COLORS.scatter,
						gradientMinColor: CHART_COLORS.scatter,
						gradientMaxColor: GRADIENT_MAX_FALLBACK,
					},
					// Category coloring draws the stored palette. The other modes draw the
					// colors a palette button copies in, so that palette counts only until
					// one of them is edited.
					marked: config => (config.colorMode === 'category' && config.colorField
						? config.colorScheme
						: findAppliedColorPreset(config, SCATTER_PLOT.presetColorKeys)),
				},
			],
		},
	]),
});
