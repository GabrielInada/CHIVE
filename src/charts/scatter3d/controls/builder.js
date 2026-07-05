/**
 * 3D-scatter control builder.
 *
 * Builds the right-sidebar control group for the 3D scatter: the Data
 * section (X/Y/Z numeric selects), the Display section (title, point
 * size, opacity), and the Styling section (point color). Uses the shared
 * chartControls factories; X/Y/Z axes are all numeric-only.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 */

import { CHART_COLORS, SCATTER3D_CHART } from '../../../config/charts.js';
import { t } from '../../../services/i18nService.js';
import {
	createColorInputControl,
	createSelectControl,
	createSliderControl,
	createTextControl,
} from '../../../modules/chartControls/shared.js';
import { groupControls } from '../../../modules/chartControls/controlGrouping.js';

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
 * @param {Object} config - The scatter3d config block.
 * @param {boolean} disabled
 * @returns {HTMLElement[]}
 */
function buildDataControls(numericOptions, config, disabled) {
	return [
		createSelectControl(
			'viz-select-scatter3d-x',
			t('chive-chart-control-scatter3d-x'),
			buildColumnSelectOptions(numericOptions),
			config.x || NONE_VALUE,
			disabled,
		),
		createSelectControl(
			'viz-select-scatter3d-y',
			t('chive-chart-control-scatter3d-y'),
			buildColumnSelectOptions(numericOptions),
			config.y || NONE_VALUE,
			disabled,
		),
		createSelectControl(
			'viz-select-scatter3d-z',
			t('chive-chart-control-scatter3d-z'),
			buildColumnSelectOptions(numericOptions),
			config.z || NONE_VALUE,
			disabled,
		),
	];
}

/**
 * Build the Display controls: the chart title, point size, and opacity.
 *
 * @private
 * @param {Object} config - The scatter3d config block.
 * @param {boolean} disabled
 * @returns {HTMLElement[]}
 */
function buildDisplayControls(config, disabled) {
	return [
		createTextControl(
			'viz-input-scatter3d-title',
			t('chive-chart-control-common-title'),
			config.customTitle,
			80,
			disabled,
		),
		createSliderControl(
			'viz-slider-scatter3d-point-size',
			t('chive-chart-control-scatter3d-point-size'),
			Number(config.pointSize ?? SCATTER3D_CHART.defaultPointSize),
			SCATTER3D_CHART.minPointSize,
			SCATTER3D_CHART.maxPointSize,
			0.005,
			disabled,
		),
		createSliderControl(
			'viz-slider-scatter3d-opacity',
			t('chive-chart-control-scatter3d-opacity'),
			Number(config.opacity ?? SCATTER3D_CHART.defaultOpacity),
			SCATTER3D_CHART.minOpacity,
			SCATTER3D_CHART.maxOpacity,
			0.05,
			disabled,
		),
	];
}

/**
 * Build the Styling controls: the uniform point color.
 *
 * @private
 * @param {Object} config - The scatter3d config block.
 * @param {boolean} disabled
 * @returns {HTMLElement[]}
 */
function buildStylingControls(config, disabled) {
	return [
		createColorInputControl(
			'viz-input-scatter3d-color',
			t('chive-chart-control-scatter3d-color'),
			config.color,
			CHART_COLORS.scatter3d,
			disabled,
		),
	];
}

/**
 * Build the 3D-scatter control sections (Data, Display, Styling).
 *
 * @param {Dataset} dataset
 * @param {string[]} numericOptions - Numeric column names; populates the X/Y/Z axis selects.
 * @param {string[]} [allColumns=[]] - All visible column names; unused (X/Y/Z are numeric-only).
 * @returns {HTMLElement[]} Array of `chart-control-section` elements.
 */
export function createScatter3dControls(dataset, numericOptions, allColumns = []) {
	void allColumns;
	const config = dataset.chartConfig.scatter3d;
	const disabled = !config.enabled;

	return groupControls([
		{ id: 'data', title: 'Data', controls: buildDataControls(numericOptions, config, disabled), expanded: true, icon: 'data' },
		{ id: 'display', title: 'Display', controls: buildDisplayControls(config, disabled), expanded: true, icon: 'display' },
		{ id: 'styling', title: 'Styling', controls: buildStylingControls(config, disabled), expanded: false, icon: 'styling' },
	]);
}
