/**
 * TIN-chart control builder.
 *
 * Builds the right-sidebar control group for the TIN (Triangulated Irregular
 * Network) surface chart: the Data, Display, Surface, and Overlays sections,
 * returned as `chart-control-section` elements. The builder is a thin
 * orchestrator over per-section helpers so each stays small; the option-dense
 * Overlays section is itself split into mesh, isoline, and threshold
 * sub-builders.
 *
 * X/Y/Z axes are all numeric-only.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 */

import { CHART_COLORS, TIN_CHART, TIN_COLOR_RAMPS } from '../../../config/charts.js';
import { t } from '../../../services/i18nService.js';
import {
	createCheckboxControl,
	createColorInputControl,
	createNumberInputControl,
	createSelectControl,
	createSliderControl,
	createTextControl,
	createColorPresetControl,
} from '../shared.js';
import { groupControls } from '../controlGrouping.js';

const NONE_VALUE = '';

/** @private */
function buildColumnSelectOptions(columns) {
	return [
		{ value: NONE_VALUE, label: t('chive-chart-option-none') },
		...columns.map(opt => ({ value: opt, label: opt })),
	];
}

/**
 * Build the Data controls: the X/Y/Z axis selects (all numeric-only).
 *
 * @private
 * @param {string[]} numericOptions
 * @param {Object} config - The tin config block.
 * @param {boolean} disabled
 * @returns {HTMLElement[]}
 */
function buildDataControls(numericOptions, config, disabled) {
	return [
		createSelectControl(
			'viz-select-tin-x',
			t('chive-chart-control-tin-x'),
			buildColumnSelectOptions(numericOptions),
			config.x || NONE_VALUE,
			disabled,
		),
		createSelectControl(
			'viz-select-tin-y',
			t('chive-chart-control-tin-y'),
			buildColumnSelectOptions(numericOptions),
			config.y || NONE_VALUE,
			disabled,
		),
		createSelectControl(
			'viz-select-tin-z',
			t('chive-chart-control-tin-z'),
			buildColumnSelectOptions(numericOptions),
			config.z || NONE_VALUE,
			disabled,
		),
	];
}

/**
 * Build the Display controls: the chart title and the X/Y axis-label toggles.
 *
 * @private
 * @param {Object} config - The tin config block.
 * @param {boolean} disabled
 * @returns {HTMLElement[]}
 */
function buildDisplayControls(config, disabled) {
	return [
		createTextControl(
			'viz-input-tin-title',
			t('chive-chart-control-common-title'),
			config.customTitle,
			80,
			disabled,
		),
		createCheckboxControl(
			'viz-toggle-tin-x-label',
			t('chive-chart-control-axis-label-x'),
			config.showXAxisLabel,
			disabled,
		),
		createCheckboxControl(
			'viz-toggle-tin-y-label',
			t('chive-chart-control-axis-label-y'),
			config.showYAxisLabel,
			disabled,
		),
	];
}

/**
 * Build the Surface controls: fill mode, subdivision depth, the color-ramp
 * picker, the custom-ramp gradient endpoints/distribution, and the palette
 * preset. The gradient/preset controls are disabled unless the ramp is
 * `custom`; the subdivision slider is disabled in `flat` fill mode.
 *
 * @private
 * @param {Object} config - The tin config block.
 * @param {boolean} disabled
 * @returns {HTMLElement[]}
 */
function buildSurfaceControls(config, disabled) {
	const fillMode = config.fillMode === 'flat' ? 'flat' : 'smooth';
	const colorRamp = TIN_COLOR_RAMPS.includes(config.colorRamp) ? config.colorRamp : TIN_CHART.defaultColorRamp;
	const isCustomRamp = colorRamp === 'custom';

	return [
		createSelectControl(
			'viz-select-tin-fill-mode',
			t('chive-chart-control-tin-fill-mode'),
			[
				{ value: 'smooth', label: t('chive-chart-control-tin-fill-smooth') },
				{ value: 'flat', label: t('chive-chart-control-tin-fill-flat') },
			],
			fillMode,
			disabled,
		),
		createSliderControl(
			'viz-slider-tin-subdivision',
			t('chive-chart-control-tin-subdivision'),
			Number(config.subdivisionDepth ?? TIN_CHART.defaultSubdivisionDepth),
			TIN_CHART.minSubdivisionDepth,
			TIN_CHART.maxSubdivisionDepth,
			1,
			disabled || fillMode === 'flat',
		),
		createSelectControl(
			'viz-select-tin-color-ramp',
			t('chive-chart-color-ramp'),
			TIN_COLOR_RAMPS.map(name => ({
				value: name,
				label: name === 'custom' ? t('chive-chart-color-ramp-custom') : name.charAt(0).toUpperCase() + name.slice(1),
			})),
			colorRamp,
			disabled,
		),
		createColorInputControl(
			'viz-input-tin-gradient-min',
			t('chive-chart-color-gradient-min'),
			config.gradientMinColor,
			CHART_COLORS.tin,
			disabled || !isCustomRamp,
		),
		createColorInputControl(
			'viz-input-tin-gradient-max',
			t('chive-chart-color-gradient-max'),
			config.gradientMaxColor,
			'#ffffff',
			disabled || !isCustomRamp,
		),
		createSelectControl(
			'viz-select-tin-gradient-distribution',
			t('chive-chart-color-gradient-distribution'),
			[
				{ value: 'value', label: t('chive-chart-color-gradient-distribution-value') },
				{ value: 'rank', label: t('chive-chart-color-gradient-distribution-rank') },
			],
			config.gradientDistribution || 'value',
			disabled,
		),
		createColorPresetControl(
			'viz-tin-color-preset',
			t('chive-chart-color-palette'),
			config.colorScheme || 'Colorblind-Safe',
			disabled || !isCustomRamp,
		),
	];
}

/**
 * Build the mesh-overlay controls: edges, points, Z labels, and the convex
 * hull, each with its dependent color/size control.
 *
 * @private
 * @param {Object} config - The tin config block.
 * @param {boolean} disabled
 * @returns {HTMLElement[]}
 */
function buildMeshOverlayControls(config, disabled) {
	return [
		createCheckboxControl(
			'viz-toggle-tin-edges',
			t('chive-chart-control-tin-show-edges'),
			config.showEdges,
			disabled,
		),
		createColorInputControl(
			'viz-input-tin-edge-color',
			t('chive-chart-control-tin-edge-color'),
			config.edgeColor,
			TIN_CHART.defaultEdgeColor,
			disabled || !config.showEdges,
		),
		createCheckboxControl(
			'viz-toggle-tin-points',
			t('chive-chart-control-tin-show-points'),
			config.showPoints,
			disabled,
		),
		createSliderControl(
			'viz-slider-tin-point-radius',
			t('chive-chart-control-tin-point-radius'),
			Number(config.pointRadius || TIN_CHART.defaultPointRadius),
			1,
			8,
			1,
			disabled || !config.showPoints,
		),
		createCheckboxControl(
			'viz-toggle-tin-z-labels',
			t('chive-chart-control-tin-show-z-labels'),
			config.showZLabels,
			disabled,
		),
		createCheckboxControl(
			'viz-toggle-tin-hull',
			t('chive-chart-control-tin-show-hull'),
			config.showHull,
			disabled,
		),
		createColorInputControl(
			'viz-input-tin-hull-color',
			t('chive-chart-control-tin-hull-color'),
			config.hullColor,
			TIN_CHART.defaultHullColor,
			disabled || !config.showHull,
		),
	];
}

/**
 * Build the isoline controls: the isolines toggle, the count/step mode and its
 * count slider / step input, the base color and width, the optional
 * color-by-Z min/max endpoints, and the isoline-label toggle plus size/color.
 *
 * @private
 * @param {Object} config - The tin config block.
 * @param {boolean} disabled
 * @returns {HTMLElement[]}
 */
function buildIsolineControls(config, disabled) {
	const isolineMode = config.isolineMode === 'step' ? 'step' : 'count';

	return [
		createCheckboxControl(
			'viz-toggle-tin-isolines',
			t('chive-chart-control-tin-show-isolines'),
			config.showIsolines,
			disabled,
		),
		createSelectControl(
			'viz-select-tin-isoline-mode',
			t('chive-chart-control-tin-isoline-mode'),
			[
				{ value: 'count', label: t('chive-chart-control-tin-isoline-mode-count') },
				{ value: 'step', label: t('chive-chart-control-tin-isoline-mode-step') },
			],
			isolineMode,
			disabled || !config.showIsolines,
		),
		createSliderControl(
			'viz-slider-tin-isoline-count',
			t('chive-chart-control-tin-isoline-count'),
			Number(config.isolineCount ?? TIN_CHART.defaultIsolineCount),
			TIN_CHART.minIsolineCount,
			TIN_CHART.maxIsolineCount,
			1,
			disabled || !config.showIsolines || isolineMode === 'step',
		),
		createNumberInputControl(
			'viz-input-tin-isoline-step',
			t('chive-chart-control-tin-isoline-step'),
			Number.isFinite(Number(config.isolineStep)) && Number(config.isolineStep) > 0
				? Number(config.isolineStep)
				: TIN_CHART.defaultIsolineStep,
			{ min: 0, step: 'any', disabled: disabled || !config.showIsolines || isolineMode === 'count' },
		),
		createColorInputControl(
			'viz-input-tin-isoline-color',
			t('chive-chart-control-tin-isoline-color'),
			config.isolineColor,
			TIN_CHART.defaultIsolineColor,
			disabled || !config.showIsolines || config.colorIsolinesByZ === true,
		),
		createSliderControl(
			'viz-slider-tin-isoline-width',
			t('chive-chart-control-tin-isoline-width'),
			Number(config.isolineWidth ?? TIN_CHART.defaultIsolineWidth),
			TIN_CHART.minIsolineWidth,
			TIN_CHART.maxIsolineWidth,
			0.1,
			disabled || !config.showIsolines,
		),
		createCheckboxControl(
			'viz-toggle-tin-color-isolines-by-z',
			t('chive-chart-control-tin-color-isolines-by-z'),
			config.colorIsolinesByZ === true,
			disabled || !config.showIsolines,
		),
		createColorInputControl(
			'viz-input-tin-isoline-min-color',
			t('chive-chart-control-tin-isoline-min-color'),
			config.isolineMinColor,
			TIN_CHART.defaultIsolineMinColor,
			disabled || !config.showIsolines || config.colorIsolinesByZ !== true,
		),
		createColorInputControl(
			'viz-input-tin-isoline-max-color',
			t('chive-chart-control-tin-isoline-max-color'),
			config.isolineMaxColor,
			TIN_CHART.defaultIsolineMaxColor,
			disabled || !config.showIsolines || config.colorIsolinesByZ !== true,
		),
		createCheckboxControl(
			'viz-toggle-tin-isoline-labels',
			t('chive-chart-control-tin-show-isoline-labels'),
			config.showIsolineLabels,
			disabled || !config.showIsolines,
		),
		createSliderControl(
			'viz-slider-tin-isoline-label-size',
			t('chive-chart-control-tin-isoline-label-size'),
			Number(config.isolineLabelSize ?? TIN_CHART.defaultIsolineLabelSize),
			TIN_CHART.minIsolineLabelSize,
			TIN_CHART.maxIsolineLabelSize,
			1,
			disabled || !config.showIsolines || !config.showIsolineLabels,
		),
		createColorInputControl(
			'viz-input-tin-isoline-label-color',
			t('chive-chart-control-tin-isoline-label-color'),
			config.isolineLabelColor,
			TIN_CHART.defaultIsolineLabelColor,
			disabled || !config.showIsolines || !config.showIsolineLabels,
		),
	];
}

/**
 * Build the threshold-line controls: the toggle, the value input, and the
 * line color and width.
 *
 * @private
 * @param {Object} config - The tin config block.
 * @param {boolean} disabled
 * @returns {HTMLElement[]}
 */
function buildThresholdControls(config, disabled) {
	return [
		createCheckboxControl(
			'viz-toggle-tin-threshold',
			t('chive-chart-control-tin-show-threshold'),
			config.showThreshold === true,
			disabled,
		),
		createNumberInputControl(
			'viz-input-tin-threshold-value',
			t('chive-chart-control-tin-threshold-value'),
			Number.isFinite(Number(config.thresholdValue)) ? Number(config.thresholdValue) : TIN_CHART.defaultThresholdValue,
			{ step: 'any', disabled: disabled || !config.showThreshold },
		),
		createColorInputControl(
			'viz-input-tin-threshold-color',
			t('chive-chart-control-tin-threshold-color'),
			config.thresholdColor,
			TIN_CHART.defaultThresholdColor,
			disabled || !config.showThreshold,
		),
		createSliderControl(
			'viz-slider-tin-threshold-width',
			t('chive-chart-control-tin-threshold-width'),
			Number(config.thresholdWidth ?? TIN_CHART.defaultThresholdWidth),
			TIN_CHART.minThresholdWidth,
			TIN_CHART.maxThresholdWidth,
			0.1,
			disabled || !config.showThreshold,
		),
	];
}

/**
 * Build the Overlays controls: the mesh overlays, the isolines, and the
 * threshold line, concatenated in their original render order.
 *
 * @private
 * @param {Object} config - The tin config block.
 * @param {boolean} disabled
 * @returns {HTMLElement[]}
 */
function buildOverlayControls(config, disabled) {
	return [
		...buildMeshOverlayControls(config, disabled),
		...buildIsolineControls(config, disabled),
		...buildThresholdControls(config, disabled),
	];
}

/**
 * Build the TIN-chart control sections (Data, Display, Surface, Overlays).
 *
 * X/Y/Z axes are all numeric-only. The Surface section hosts subdivision
 * depth and the color-ramp picker. The Overlays section hosts isolines and
 * the optional threshold line.
 *
 * @param {Dataset} dataset
 * @param {string[]} numericOptions - Numeric column names; populates the X/Y/Z axis selects.
 * @param {string[]} [allColumns=[]] - All visible column names; unused (X/Y/Z are numeric-only).
 * @returns {HTMLElement[]} Array of `chart-control-section` elements.
 */
export function createTinControls(dataset, numericOptions, allColumns = []) {
	void allColumns;
	const config = dataset.chartConfig.tin;
	const disabled = !config.enabled;

	return groupControls([
		{ id: 'data', title: 'Data', controls: buildDataControls(numericOptions, config, disabled), expanded: true, icon: 'data' },
		{ id: 'display', title: 'Display', controls: buildDisplayControls(config, disabled), expanded: true, icon: 'display' },
		{ id: 'surface', title: 'Surface', controls: buildSurfaceControls(config, disabled), expanded: false, icon: 'styling' },
		{ id: 'overlays', title: 'Overlays', controls: buildOverlayControls(config, disabled), expanded: false, icon: 'advanced' },
	]);
}
