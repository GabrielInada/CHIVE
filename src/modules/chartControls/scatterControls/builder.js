/**
 * Scatter-plot control builder.
 *
 * Builds the right-sidebar control group for the scatter plot: the Data,
 * Display, Analytics (regression), and Styling sections, returned as
 * `chart-control-section` elements. Largest of the per-chart builders because
 * of the axis-scale (linear/log) cross-constraints, the size-field/color-field
 * mappings, and the optional OLS regression section.
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
	const disabled = !dataset.chartConfig.scatter.enabled;
	const categoryOptions = allOptions.filter(option => !numericOptions.includes(option));

	// ====== DATA & AGGREGATION SECTION (X/Y axes) ======
	const dataControls = [];

	const xOptions = [
		{ value: '', label: t('chive-chart-option-none') },
		...allOptions.map(opt => ({ value: opt, label: opt })),
	];
	dataControls.push(createSelectControl(
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
	dataControls.push(createSelectControl(
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
	dataControls.push(createSelectControl(
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
	dataControls.push(createSelectControl(
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
	dataControls.push(createSelectControl(
		'viz-select-scatter-categorical-mode',
		t('chive-chart-control-scatter-categorical-mode'),
		categoricalModeOptions,
		config.categoricalPairMode || 'jitter',
		disabled || !bothAxesCategorical,
	));

	// ====== DISPLAY SECTION (Labels and dimensions) ======
	const displayControls = [];

	displayControls.push(createCheckboxControl(
		'viz-toggle-scatter-x-label',
		t('chive-chart-control-axis-label-x'),
		config.showXAxisLabel,
		disabled
	));

	displayControls.push(createCheckboxControl(
		'viz-toggle-scatter-y-label',
		t('chive-chart-control-axis-label-y'),
		config.showYAxisLabel,
		disabled
	));

	displayControls.push(createTextControl(
		'viz-input-scatter-title',
		t('chive-chart-control-common-title'),
		config.customTitle,
		80,
		disabled
	));

	// ====== STYLING SECTION (Colors and appearance) ======
	const stylingControls = [];

	const radiusOptions = [
		{ value: '2', label: '2' },
		{ value: '3', label: '3' },
		{ value: '4', label: '4' },
		{ value: '6', label: '6' },
	];
	stylingControls.push(createSelectControl(
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
	stylingControls.push(createSelectControl(
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
	stylingControls.push(createSelectControl(
		'viz-select-scatter-size-mode',
		t('chive-chart-control-scatter-size-mode'),
		sizeModeOptions,
		config.sizeMode || 'uniform',
		disabled,
	));

	stylingControls.push(createSelectControl(
		'viz-select-scatter-size-field',
		t('chive-chart-control-scatter-size-field'),
		[
			{ value: '', label: t('chive-chart-option-none') },
			...numericOptions.map(opt => ({ value: opt, label: opt })),
		],
		config.sizeField,
		disabled || config.sizeMode !== 'numeric',
	));

	stylingControls.push(createSliderControl(
		'viz-slider-scatter-size-min',
		t('chive-chart-control-scatter-size-min'),
		Number(config.sizeMin || 2),
		1,
		10,
		1,
		disabled || config.sizeMode !== 'numeric',
	));

	stylingControls.push(createSliderControl(
		'viz-slider-scatter-size-max',
		t('chive-chart-control-scatter-size-max'),
		Number(config.sizeMax || 12),
		5,
		30,
		1,
		disabled || config.sizeMode !== 'numeric',
	));

	const colorModeOptions = [
		{ value: 'uniform', label: t('chive-chart-color-uniform') },
		{ value: 'numeric', label: t('chive-chart-color-scatter-numeric') },
		{ value: 'category', label: t('chive-chart-color-scatter-category') },
	];
	stylingControls.push(createSelectControl(
		'viz-select-scatter-color-mode',
		t('chive-chart-color-mode'),
		colorModeOptions,
		config.colorMode,
		disabled,
	));

	const colorFieldOptions = config.colorMode === 'category'
		? categoryOptions
		: numericOptions;
	stylingControls.push(createSelectControl(
		'viz-select-scatter-color-field',
		t('chive-chart-color-scatter-field'),
		[
			{ value: '', label: t('chive-chart-option-none') },
			...colorFieldOptions.map(opt => ({ value: opt, label: opt })),
		],
		config.colorField,
		disabled || config.colorMode === 'uniform',
	));

	stylingControls.push(createColorInputControl(
		'viz-input-scatter-color',
		t('chive-chart-control-scatter-color'),
		config.color,
		CHART_COLORS.scatter,
		disabled || config.colorMode !== 'uniform',
	));

	stylingControls.push(createColorInputControl(
		'viz-input-scatter-gradient-min',
		t('chive-chart-color-gradient-min'),
		config.gradientMinColor,
		CHART_COLORS.scatter,
		disabled || config.colorMode === 'uniform',
	));

	stylingControls.push(createColorInputControl(
		'viz-input-scatter-gradient-max',
		t('chive-chart-color-gradient-max'),
		config.gradientMaxColor,
		'#ffffff',
		disabled || config.colorMode === 'uniform',
	));

	if (config.colorMode === 'numeric') {
		stylingControls.push(createSelectControl(
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
		stylingControls.push(createSelectControl(
			'viz-select-scatter-color-scheme',
			t('chive-chart-color-scheme'),
			Object.keys(COLOR_PRESETS).map(name => ({ value: name, label: name })),
			config.colorScheme || 'Bold',
			disabled,
		));
	}

	stylingControls.push(createColorPresetControl(
		'viz-scatter-color-preset',
		t('chive-chart-color-palette'),
		config.colorScheme || 'Bold',
		disabled
	));

	// ====== ANALYTICS SECTION (Trendline / regression) ======
	const regressionConfig = config.regression || {};
	const bothAxesNumeric = Boolean(
		config.x
		&& config.y
		&& numericOptions.includes(config.x)
		&& numericOptions.includes(config.y)
	);
	const regressionEnabled = regressionConfig.enabled === true;
	const hasCategoricalColumns = categoryOptions.length > 0;
	const analyticsControls = [];

	analyticsControls.push(createCheckboxControl(
		'viz-toggle-scatter-regression-enabled',
		t('chive-chart-control-scatter-regression-enabled'),
		regressionEnabled,
		disabled || !bothAxesNumeric,
	));

	analyticsControls.push(createSelectControl(
		'viz-select-scatter-regression-mode',
		t('chive-chart-control-scatter-regression-mode'),
		[
			{ value: 'overall', label: t('chive-chart-control-scatter-regression-mode-overall') },
			{ value: 'perCategory', label: t('chive-chart-control-scatter-regression-mode-per-category') },
		],
		regressionConfig.mode === 'perCategory' ? 'perCategory' : 'overall',
		disabled || !regressionEnabled || !hasCategoricalColumns,
	));

	analyticsControls.push(createCheckboxControl(
		'viz-toggle-scatter-regression-ci',
		t('chive-chart-control-scatter-regression-show-ci'),
		regressionConfig.showCI !== false,
		disabled || !regressionEnabled,
	));

	analyticsControls.push(createCheckboxControl(
		'viz-toggle-scatter-regression-equation',
		t('chive-chart-control-scatter-regression-show-equation'),
		regressionConfig.showEquation !== false,
		disabled || !regressionEnabled,
	));

	analyticsControls.push(createCheckboxControl(
		'viz-toggle-scatter-regression-r2',
		t('chive-chart-control-scatter-regression-show-r2'),
		regressionConfig.showR2 !== false,
		disabled || !regressionEnabled,
	));

	// ====== Group and return all sections ======
	return groupControls([
		{ id: 'data', title: 'Data & Aggregation', controls: dataControls, expanded: true, icon: 'data' },
		{ id: 'display', title: 'Display', controls: displayControls, expanded: true, icon: 'display' },
		{ id: 'analytics', title: t('chive-chart-control-scatter-regression-section'), controls: analyticsControls, expanded: false, icon: 'advanced' },
		{ id: 'styling', title: 'Styling', controls: stylingControls, expanded: false, icon: 'styling' },
	]);
}
