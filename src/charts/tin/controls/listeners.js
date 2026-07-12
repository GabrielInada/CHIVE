/**
 * TIN-chart control listeners.
 *
 * Wires the right-sidebar TIN controls to the active dataset config: the
 * X/Y/Z numeric clamp, the enum/checkbox/slider/number/color inputs, and the
 * palette-preset mapping onto the custom gradient endpoints.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 */

import { CHART_COLORS, TIN_CHART, TIN_COLOR_RAMPS } from '../../../config/charts.js';
import { COLOR_PRESETS } from '../../../modules/chartControls/shared.js';
import {
	setupSelectListeners,
	setupCheckboxListeners,
	setupTextInputListener,
	setupColorInputListener,
	setupNumberInputListener,
	setupSliderListener,
	setupColorPresetListeners,
} from '../../../modules/chartControls/controlListenerHelpers.js';

/**
 * Wire listeners for every TIN-chart control. X/Y/Z selects clamp to
 * `numericOptions`; out-of-list values reset to `null`.
 *
 * @param {Dataset} dataset
 * @param {string[]} numericOptions
 * @param {string[]} allColumns - Currently unused.
 * @param {() => void} [onConfigChanged]
 * @returns {void}
 */
export function setupTinControlListeners(dataset, numericOptions, allColumns, onConfigChanged) {
	void allColumns;

	setupSelectListeners([
		{
			id: 'viz-select-tin-x',
			key: 'x',
			transform: v => (numericOptions.includes(v) ? v : null),
		},
		{
			id: 'viz-select-tin-y',
			key: 'y',
			transform: v => (numericOptions.includes(v) ? v : null),
		},
		{
			id: 'viz-select-tin-z',
			key: 'z',
			transform: v => (numericOptions.includes(v) ? v : null),
		},
		{
			id: 'viz-select-tin-gradient-distribution',
			key: 'gradientDistribution',
			transform: v => (['value', 'rank'].includes(v) ? v : 'value'),
		},
		{
			id: 'viz-select-tin-fill-mode',
			key: 'fillMode',
			transform: v => (v === 'flat' ? 'flat' : 'smooth'),
		},
		{
			id: 'viz-select-tin-isoline-mode',
			key: 'isolineMode',
			transform: v => (v === 'step' ? 'step' : 'count'),
		},
		{
			id: 'viz-select-tin-color-ramp',
			key: 'colorRamp',
			transform: v => (TIN_COLOR_RAMPS.includes(v) ? v : TIN_CHART.defaultColorRamp),
		},
	], dataset, 'tin', onConfigChanged);

	setupCheckboxListeners([
		{ id: 'viz-toggle-tin-x-label', key: 'showXAxisLabel' },
		{ id: 'viz-toggle-tin-y-label', key: 'showYAxisLabel' },
		{ id: 'viz-toggle-tin-edges', key: 'showEdges' },
		{ id: 'viz-toggle-tin-points', key: 'showPoints' },
		{ id: 'viz-toggle-tin-z-labels', key: 'showZLabels' },
		{ id: 'viz-toggle-tin-hull', key: 'showHull' },
		{ id: 'viz-toggle-tin-isolines', key: 'showIsolines' },
		{ id: 'viz-toggle-tin-isoline-labels', key: 'showIsolineLabels' },
		{ id: 'viz-toggle-tin-color-isolines-by-z', key: 'colorIsolinesByZ' },
		{ id: 'viz-toggle-tin-threshold', key: 'showThreshold' },
	], dataset, 'tin', onConfigChanged);

	setupTextInputListener('viz-input-tin-title', 'customTitle', dataset, 'tin', onConfigChanged);
	setupSliderListener('viz-slider-tin-subdivision', 'subdivisionDepth', dataset, 'tin', onConfigChanged);
	setupSliderListener('viz-slider-tin-point-radius', 'pointRadius', dataset, 'tin', onConfigChanged);
	setupSliderListener('viz-slider-tin-isoline-count', 'isolineCount', dataset, 'tin', onConfigChanged);
	setupSliderListener('viz-slider-tin-isoline-width', 'isolineWidth', dataset, 'tin', onConfigChanged);
	setupSliderListener('viz-slider-tin-isoline-label-size', 'isolineLabelSize', dataset, 'tin', onConfigChanged);
	setupSliderListener('viz-slider-tin-threshold-width', 'thresholdWidth', dataset, 'tin', onConfigChanged);
	setupNumberInputListener('viz-input-tin-threshold-value', 'thresholdValue', TIN_CHART.defaultThresholdValue, dataset, 'tin', onConfigChanged);
	setupNumberInputListener('viz-input-tin-isoline-step', 'isolineStep', TIN_CHART.defaultIsolineStep, dataset, 'tin', onConfigChanged);

	setupColorInputListener('viz-input-tin-gradient-min', 'gradientMinColor', CHART_COLORS.tin, dataset, 'tin', onConfigChanged);
	setupColorInputListener('viz-input-tin-gradient-max', 'gradientMaxColor', '#ffffff', dataset, 'tin', onConfigChanged);
	setupColorInputListener('viz-input-tin-edge-color', 'edgeColor', TIN_CHART.defaultEdgeColor, dataset, 'tin', onConfigChanged);
	setupColorInputListener('viz-input-tin-hull-color', 'hullColor', TIN_CHART.defaultHullColor, dataset, 'tin', onConfigChanged);
	setupColorInputListener('viz-input-tin-isoline-color', 'isolineColor', TIN_CHART.defaultIsolineColor, dataset, 'tin', onConfigChanged);
	setupColorInputListener('viz-input-tin-isoline-label-color', 'isolineLabelColor', TIN_CHART.defaultIsolineLabelColor, dataset, 'tin', onConfigChanged);
	setupColorInputListener('viz-input-tin-isoline-min-color', 'isolineMinColor', TIN_CHART.defaultIsolineMinColor, dataset, 'tin', onConfigChanged);
	setupColorInputListener('viz-input-tin-isoline-max-color', 'isolineMaxColor', TIN_CHART.defaultIsolineMaxColor, dataset, 'tin', onConfigChanged);
	setupColorInputListener('viz-input-tin-threshold-color', 'thresholdColor', TIN_CHART.defaultThresholdColor, dataset, 'tin', onConfigChanged);

	setupColorPresetListeners(
		'viz-tin-color-preset',
		{ gradientMinColor: 0, gradientMaxColor: -1 },
		{ gradientMinColor: CHART_COLORS.tin, gradientMaxColor: '#ffffff' },
		dataset,
		'tin',
		onConfigChanged,
		COLOR_PRESETS,
	);
}
