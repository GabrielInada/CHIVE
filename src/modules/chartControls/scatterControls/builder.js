/**
 * Scatter-plot control builder.
 *
 * Builds the right-sidebar control group for the scatter plot: the Data,
 * Display, Analytics (regression), and Styling sections, returned as
 * `chart-control-section` elements. The most option-dense Cartesian builder
 * because of the axis-scale (linear/log) cross-constraints, the
 * size-field/color-field mappings, and the optional OLS regression section, so
 * `createScatterPlotControls` is a thin orchestrator over one module-private
 * helper per section (`buildDataControls`, `buildDisplayControls`,
 * `buildStylingControls`, `buildAnalyticsControls`); the large Styling section
 * is itself the concat of `buildMarkerControls` and `buildColorControls`.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 */

import { CHART_COLORS } from '../../../config/charts.js';
import { t } from '../../../services/i18nService.js';
import { createCheckboxControl, createColorInputControl, createSliderControl, createTextControl, createSelectControl } from '../shared.js';
import { COLOR_PRESETS, createColorPresetControl } from '../shared.js';
import { groupControls } from '../controlGrouping.js';

/**
 * Build the scatter-plot control sections (Data, Display, Analytics, Styling).
 *
 * The Analytics section (collapsed by default) hosts the OLS regression
 * toggles and confidence-interval controls.
 *
 * @param {Dataset} dataset
 * @param {string[]} numericOptions - Numeric column names; populates X/Y axes and size/color field selects.
 * @param {string[]} [allOptions=[]] - All visible column names; categorical axes are derived as `allOptions - numericOptions`.
 * @returns {HTMLElement[]} Array of `chart-control-section` elements.
 */
export function createScatterPlotControls(dataset, numericOptions, allOptions = []) {
	const config = dataset.chartConfig.scatter;
	const disabled = !config.enabled;
	const categoryOptions = allOptions.filter(option => !numericOptions.includes(option));

	// Build each section's controls in the original construction order (Data ->
	// Display -> Styling -> Analytics), then group them in the section order the
	// sidebar renders (Data -> Display -> Analytics -> Styling). The two orders
	// differ, so the arrays are precomputed before grouping rather than built
	// inline inside `groupControls`.
	const dataControls = buildDataControls(config, numericOptions, allOptions, disabled);
	const displayControls = buildDisplayControls(config, disabled);
	const stylingControls = buildStylingControls(config, numericOptions, categoryOptions, disabled);
	const analyticsControls = buildAnalyticsControls(config, numericOptions, categoryOptions, disabled);

	return groupControls([
		{ id: 'data', title: 'Data & Aggregation', controls: dataControls, expanded: true, icon: 'data' },
		{ id: 'display', title: 'Display', controls: displayControls, expanded: true, icon: 'display' },
		{ id: 'analytics', title: t('chive-chart-control-scatter-regression-section'), controls: analyticsControls, expanded: false, icon: 'advanced' },
		{ id: 'styling', title: 'Styling', controls: stylingControls, expanded: false, icon: 'styling' },
	]);
}

/**
 * Build the Data & Aggregation controls: X/Y axis selects, the per-axis
 * linear/log scale selects (disabled when the chosen axis is categorical), and
 * the categorical-pair mode (enabled only when both axes are categorical).
 *
 * @param {Dataset['chartConfig']['scatter']} config
 * @param {string[]} numericOptions
 * @param {string[]} allOptions
 * @param {boolean} disabled
 * @returns {HTMLElement[]}
 */
function buildDataControls(config, numericOptions, allOptions, disabled) {
	const controls = [];

	const xOptions = [
		{ value: '', label: t('chive-chart-option-none') },
		...allOptions.map(opt => ({ value: opt, label: opt })),
	];
	controls.push(createSelectControl(
		'viz-select-x',
		t('chive-chart-control-scatter-x'),
		xOptions,
		config.x,
		disabled,
	));

	const yOptions = [
		{ value: '', label: t('chive-chart-option-none') },
		...allOptions.map(opt => ({ value: opt, label: opt })),
	];
	controls.push(createSelectControl(
		'viz-select-y',
		t('chive-chart-control-scatter-y'),
		yOptions,
		config.y,
		disabled,
	));

	const xScaleOptions = [
		{ value: 'linear', label: t('chive-chart-scale-linear') },
		{ value: 'log', label: t('chive-chart-scale-log') },
	];
	controls.push(createSelectControl(
		'viz-select-scatter-xscale',
		t('chive-chart-control-scatter-xscale'),
		xScaleOptions,
		config.xScale,
		disabled || !numericOptions.includes(config.x),
	));

	const yScaleOptions = [
		{ value: 'linear', label: t('chive-chart-scale-linear') },
		{ value: 'log', label: t('chive-chart-scale-log') },
	];
	controls.push(createSelectControl(
		'viz-select-scatter-yscale',
		t('chive-chart-control-scatter-yscale'),
		yScaleOptions,
		config.yScale,
		disabled || !numericOptions.includes(config.y),
	));

	const bothAxesCategorical = Boolean(
		config.x
		&& config.y
		&& !numericOptions.includes(config.x)
		&& !numericOptions.includes(config.y)
	);
	const categoricalModeOptions = [
		{ value: 'jitter', label: t('chive-chart-control-scatter-categorical-mode-jitter') },
		{ value: 'aggregate', label: t('chive-chart-control-scatter-categorical-mode-aggregate') },
	];
	controls.push(createSelectControl(
		'viz-select-scatter-categorical-mode',
		t('chive-chart-control-scatter-categorical-mode'),
		categoricalModeOptions,
		config.categoricalPairMode || 'jitter',
		disabled || !bothAxesCategorical,
	));

	return controls;
}

/**
 * Build the Display controls: the X/Y axis-label toggles and the custom-title
 * text input.
 *
 * @param {Dataset['chartConfig']['scatter']} config
 * @param {boolean} disabled
 * @returns {HTMLElement[]}
 */
function buildDisplayControls(config, disabled) {
	const controls = [];

	controls.push(createCheckboxControl(
		'viz-toggle-scatter-x-label',
		t('chive-chart-control-axis-label-x'),
		config.showXAxisLabel,
		disabled
	));

	controls.push(createCheckboxControl(
		'viz-toggle-scatter-y-label',
		t('chive-chart-control-axis-label-y'),
		config.showYAxisLabel,
		disabled
	));

	controls.push(createTextControl(
		'viz-input-scatter-title',
		t('chive-chart-control-common-title'),
		config.customTitle,
		80,
		disabled
	));

	return controls;
}

/**
 * Build the Styling controls as the marker controls followed by the color
 * controls. Concatenating in this order preserves the exact control order the
 * structure snapshot pins.
 *
 * @param {Dataset['chartConfig']['scatter']} config
 * @param {string[]} numericOptions
 * @param {string[]} categoryOptions
 * @param {boolean} disabled
 * @returns {HTMLElement[]}
 */
function buildStylingControls(config, numericOptions, categoryOptions, disabled) {
	return [
		...buildMarkerControls(config, numericOptions, disabled),
		...buildColorControls(config, numericOptions, categoryOptions, disabled),
	];
}

/**
 * Build the marker styling controls: radius, opacity, the size encoding mode,
 * and (gated on numeric size mode) the size field and min/max radius sliders.
 *
 * @param {Dataset['chartConfig']['scatter']} config
 * @param {string[]} numericOptions
 * @param {boolean} disabled
 * @returns {HTMLElement[]}
 */
function buildMarkerControls(config, numericOptions, disabled) {
	const controls = [];

	const radiusOptions = [
		{ value: '2', label: '2' },
		{ value: '3', label: '3' },
		{ value: '4', label: '4' },
		{ value: '6', label: '6' },
	];
	controls.push(createSelectControl(
		'viz-select-scatter-radius',
		t('chive-chart-control-scatter-radius'),
		radiusOptions,
		config.radius,
		disabled,
	));

	const opacityOptions = [
		{ value: '0.3', label: '30%' },
		{ value: '0.5', label: '50%' },
		{ value: '0.7', label: '70%' },
		{ value: '1', label: '100%' },
	];
	controls.push(createSelectControl(
		'viz-select-scatter-opacity',
		t('chive-chart-control-scatter-opacity'),
		opacityOptions,
		config.opacity,
		disabled,
	));

	const sizeModeOptions = [
		{ value: 'uniform', label: t('chive-chart-size-uniform') },
		{ value: 'numeric', label: t('chive-chart-size-numeric') },
	];
	controls.push(createSelectControl(
		'viz-select-scatter-size-mode',
		t('chive-chart-control-scatter-size-mode'),
		sizeModeOptions,
		config.sizeMode || 'uniform',
		disabled,
	));

	controls.push(createSelectControl(
		'viz-select-scatter-size-field',
		t('chive-chart-control-scatter-size-field'),
		[
			{ value: '', label: t('chive-chart-option-none') },
			...numericOptions.map(opt => ({ value: opt, label: opt })),
		],
		config.sizeField,
		disabled || config.sizeMode !== 'numeric',
	));

	controls.push(createSliderControl(
		'viz-slider-scatter-size-min',
		t('chive-chart-control-scatter-size-min'),
		Number(config.sizeMin || 2),
		1,
		10,
		1,
		disabled || config.sizeMode !== 'numeric',
	));

	controls.push(createSliderControl(
		'viz-slider-scatter-size-max',
		t('chive-chart-control-scatter-size-max'),
		Number(config.sizeMax || 12),
		5,
		30,
		1,
		disabled || config.sizeMode !== 'numeric',
	));

	return controls;
}

/**
 * Build the color styling controls: color mode, color field (numeric or
 * categorical depending on mode), the uniform color, the gradient endpoints,
 * the mode-specific gradient-distribution (numeric) or color-scheme (category)
 * control, and the color-preset palette picker.
 *
 * @param {Dataset['chartConfig']['scatter']} config
 * @param {string[]} numericOptions
 * @param {string[]} categoryOptions
 * @param {boolean} disabled
 * @returns {HTMLElement[]}
 */
function buildColorControls(config, numericOptions, categoryOptions, disabled) {
	const controls = [];

	const colorModeOptions = [
		{ value: 'uniform', label: t('chive-chart-color-uniform') },
		{ value: 'numeric', label: t('chive-chart-color-scatter-numeric') },
		{ value: 'category', label: t('chive-chart-color-scatter-category') },
	];
	controls.push(createSelectControl(
		'viz-select-scatter-color-mode',
		t('chive-chart-color-mode'),
		colorModeOptions,
		config.colorMode,
		disabled,
	));

	const colorFieldOptions = config.colorMode === 'category'
		? categoryOptions
		: numericOptions;
	controls.push(createSelectControl(
		'viz-select-scatter-color-field',
		t('chive-chart-color-scatter-field'),
		[
			{ value: '', label: t('chive-chart-option-none') },
			...colorFieldOptions.map(opt => ({ value: opt, label: opt })),
		],
		config.colorField,
		disabled || config.colorMode === 'uniform',
	));

	controls.push(createColorInputControl(
		'viz-input-scatter-color',
		t('chive-chart-control-scatter-color'),
		config.color,
		CHART_COLORS.scatter,
		disabled || config.colorMode !== 'uniform',
	));

	controls.push(createColorInputControl(
		'viz-input-scatter-gradient-min',
		t('chive-chart-color-gradient-min'),
		config.gradientMinColor,
		CHART_COLORS.scatter,
		disabled || config.colorMode === 'uniform',
	));

	controls.push(createColorInputControl(
		'viz-input-scatter-gradient-max',
		t('chive-chart-color-gradient-max'),
		config.gradientMaxColor,
		'#ffffff',
		disabled || config.colorMode === 'uniform',
	));

	if (config.colorMode === 'numeric') {
		controls.push(createSelectControl(
			'viz-select-scatter-gradient-distribution',
			t('chive-chart-color-gradient-distribution'),
			[
				{ value: 'value', label: t('chive-chart-color-gradient-distribution-value') },
				{ value: 'rank', label: t('chive-chart-color-gradient-distribution-rank') },
			],
			config.gradientDistribution || 'value',
			disabled,
		));
	}

	if (config.colorMode === 'category') {
		controls.push(createSelectControl(
			'viz-select-scatter-color-scheme',
			t('chive-chart-color-scheme'),
			Object.keys(COLOR_PRESETS).map(name => ({ value: name, label: name })),
			config.colorScheme || 'Bold',
			disabled,
		));
	}

	controls.push(createColorPresetControl(
		'viz-scatter-color-preset',
		t('chive-chart-color-palette'),
		config.colorScheme || 'Bold',
		disabled
	));

	return controls;
}

/**
 * Build the Analytics controls: the OLS regression toggle (enabled only when
 * both axes are numeric) and the dependent mode/CI/equation/R^2 controls
 * (enabled only once regression is on).
 *
 * @param {Dataset['chartConfig']['scatter']} config
 * @param {string[]} numericOptions
 * @param {string[]} categoryOptions
 * @param {boolean} disabled
 * @returns {HTMLElement[]}
 */
function buildAnalyticsControls(config, numericOptions, categoryOptions, disabled) {
	const regressionConfig = config.regression || {};
	const bothAxesNumeric = Boolean(
		config.x
		&& config.y
		&& numericOptions.includes(config.x)
		&& numericOptions.includes(config.y)
	);
	const regressionEnabled = regressionConfig.enabled === true;
	const hasCategoricalColumns = categoryOptions.length > 0;
	const controls = [];

	controls.push(createCheckboxControl(
		'viz-toggle-scatter-regression-enabled',
		t('chive-chart-control-scatter-regression-enabled'),
		regressionEnabled,
		disabled || !bothAxesNumeric,
	));

	controls.push(createSelectControl(
		'viz-select-scatter-regression-mode',
		t('chive-chart-control-scatter-regression-mode'),
		[
			{ value: 'overall', label: t('chive-chart-control-scatter-regression-mode-overall') },
			{ value: 'perCategory', label: t('chive-chart-control-scatter-regression-mode-per-category') },
		],
		regressionConfig.mode === 'perCategory' ? 'perCategory' : 'overall',
		disabled || !regressionEnabled || !hasCategoricalColumns,
	));

	controls.push(createCheckboxControl(
		'viz-toggle-scatter-regression-ci',
		t('chive-chart-control-scatter-regression-show-ci'),
		regressionConfig.showCI !== false,
		disabled || !regressionEnabled,
	));

	controls.push(createCheckboxControl(
		'viz-toggle-scatter-regression-equation',
		t('chive-chart-control-scatter-regression-show-equation'),
		regressionConfig.showEquation !== false,
		disabled || !regressionEnabled,
	));

	controls.push(createCheckboxControl(
		'viz-toggle-scatter-regression-r2',
		t('chive-chart-control-scatter-regression-show-r2'),
		regressionConfig.showR2 !== false,
		disabled || !regressionEnabled,
	));

	return controls;
}
