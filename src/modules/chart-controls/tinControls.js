import { CHART_COLORS, TIN_CHART, TIN_COLOR_RAMPS } from '../../config/charts.js';
import { t } from '../../services/i18nService.js';
import {
	createCheckboxControl,
	createColorInputControl,
	createNumberInputControl,
	createSelectControl,
	createSliderControl,
	createTextControl,
	createColorPresetControl,
	COLOR_PRESETS,
} from './shared.js';
import { groupControls } from './controlGrouping.js';
import {
	setupExpandListener,
	setupSelectListeners,
	setupCheckboxListeners,
	setupTextInputListener,
	setupColorInputListener,
	setupNumberInputListener,
	setupSliderListener,
	setupColorPresetListeners,
} from './controlListenerHelpers.js';

const NONE_VALUE = '';

function buildColumnSelectOptions(columns) {
	return [
		{ value: NONE_VALUE, label: t('chive-chart-option-none') },
		...columns.map(opt => ({ value: opt, label: opt })),
	];
}

export function createTinControls(dataset, numericOptions, allColumns = []) {
	void allColumns;
	const config = dataset.configGraficos.tin;
	const disabled = !config.enabled;

	const dataControls = [];
	dataControls.push(createSelectControl(
		'viz-select-tin-x',
		t('chive-chart-control-tin-x'),
		buildColumnSelectOptions(numericOptions),
		config.x || NONE_VALUE,
		disabled,
	));
	dataControls.push(createSelectControl(
		'viz-select-tin-y',
		t('chive-chart-control-tin-y'),
		buildColumnSelectOptions(numericOptions),
		config.y || NONE_VALUE,
		disabled,
	));
	dataControls.push(createSelectControl(
		'viz-select-tin-z',
		t('chive-chart-control-tin-z'),
		buildColumnSelectOptions(numericOptions),
		config.z || NONE_VALUE,
		disabled,
	));

	const displayControls = [];
	displayControls.push(createTextControl(
		'viz-input-tin-title',
		t('chive-chart-control-common-title'),
		config.customTitle,
		80,
		disabled,
	));
	displayControls.push(createSliderControl(
		'viz-slider-tin-height',
		t('chive-chart-control-common-height'),
		Number(config.chartHeight || 460),
		220,
		900,
		10,
		disabled,
	));
	displayControls.push(createCheckboxControl(
		'viz-toggle-tin-x-label',
		t('chive-chart-control-axis-label-x'),
		config.showXAxisLabel,
		disabled,
	));
	displayControls.push(createCheckboxControl(
		'viz-toggle-tin-y-label',
		t('chive-chart-control-axis-label-y'),
		config.showYAxisLabel,
		disabled,
	));

	const surfaceControls = [];
	const fillMode = config.fillMode === 'flat' ? 'flat' : 'smooth';
	surfaceControls.push(createSelectControl(
		'viz-select-tin-fill-mode',
		t('chive-chart-control-tin-fill-mode'),
		[
			{ value: 'smooth', label: t('chive-chart-control-tin-fill-smooth') },
			{ value: 'flat', label: t('chive-chart-control-tin-fill-flat') },
		],
		fillMode,
		disabled,
	));
	surfaceControls.push(createSliderControl(
		'viz-slider-tin-subdivision',
		t('chive-chart-control-tin-subdivision'),
		Number(config.subdivisionDepth ?? TIN_CHART.defaultSubdivisionDepth),
		TIN_CHART.minSubdivisionDepth,
		TIN_CHART.maxSubdivisionDepth,
		1,
		disabled || fillMode === 'flat',
	));

	const colorRamp = TIN_COLOR_RAMPS.includes(config.colorRamp) ? config.colorRamp : TIN_CHART.defaultColorRamp;
	const isCustomRamp = colorRamp === 'custom';
	surfaceControls.push(createSelectControl(
		'viz-select-tin-color-ramp',
		t('chive-chart-color-ramp'),
		TIN_COLOR_RAMPS.map(name => ({
			value: name,
			label: name === 'custom' ? t('chive-chart-color-ramp-custom') : name.charAt(0).toUpperCase() + name.slice(1),
		})),
		colorRamp,
		disabled,
	));

	surfaceControls.push(createColorInputControl(
		'viz-input-tin-gradient-min',
		t('chive-chart-color-gradient-min'),
		config.gradientMinColor,
		CHART_COLORS.tin,
		disabled || !isCustomRamp,
	));

	surfaceControls.push(createColorInputControl(
		'viz-input-tin-gradient-max',
		t('chive-chart-color-gradient-max'),
		config.gradientMaxColor,
		'#ffffff',
		disabled || !isCustomRamp,
	));

	surfaceControls.push(createSelectControl(
		'viz-select-tin-gradient-distribution',
		t('chive-chart-color-gradient-distribution'),
		[
			{ value: 'value', label: t('chive-chart-color-gradient-distribution-value') },
			{ value: 'rank', label: t('chive-chart-color-gradient-distribution-rank') },
		],
		config.gradientDistribution || 'value',
		disabled,
	));

	surfaceControls.push(createColorPresetControl(
		'viz-tin-color-preset',
		t('chive-chart-color-palette'),
		config.colorScheme || 'Colorblind-Safe',
		disabled || !isCustomRamp,
	));

	const overlayControls = [];
	overlayControls.push(createCheckboxControl(
		'viz-toggle-tin-edges',
		t('chive-chart-control-tin-show-edges'),
		config.showEdges,
		disabled,
	));
	overlayControls.push(createColorInputControl(
		'viz-input-tin-edge-color',
		t('chive-chart-control-tin-edge-color'),
		config.edgeColor,
		TIN_CHART.defaultEdgeColor,
		disabled || !config.showEdges,
	));

	overlayControls.push(createCheckboxControl(
		'viz-toggle-tin-points',
		t('chive-chart-control-tin-show-points'),
		config.showPoints,
		disabled,
	));
	overlayControls.push(createSliderControl(
		'viz-slider-tin-point-radius',
		t('chive-chart-control-tin-point-radius'),
		Number(config.pointRadius || TIN_CHART.defaultPointRadius),
		1,
		8,
		1,
		disabled || !config.showPoints,
	));
	overlayControls.push(createCheckboxControl(
		'viz-toggle-tin-z-labels',
		t('chive-chart-control-tin-show-z-labels'),
		config.showZLabels,
		disabled,
	));
	overlayControls.push(createCheckboxControl(
		'viz-toggle-tin-hull',
		t('chive-chart-control-tin-show-hull'),
		config.showHull,
		disabled,
	));
	overlayControls.push(createColorInputControl(
		'viz-input-tin-hull-color',
		t('chive-chart-control-tin-hull-color'),
		config.hullColor,
		TIN_CHART.defaultHullColor,
		disabled || !config.showHull,
	));

	overlayControls.push(createCheckboxControl(
		'viz-toggle-tin-isolines',
		t('chive-chart-control-tin-show-isolines'),
		config.showIsolines,
		disabled,
	));
	const isolineMode = config.isolineMode === 'step' ? 'step' : 'count';
	overlayControls.push(createSelectControl(
		'viz-select-tin-isoline-mode',
		t('chive-chart-control-tin-isoline-mode'),
		[
			{ value: 'count', label: t('chive-chart-control-tin-isoline-mode-count') },
			{ value: 'step', label: t('chive-chart-control-tin-isoline-mode-step') },
		],
		isolineMode,
		disabled || !config.showIsolines,
	));
	overlayControls.push(createSliderControl(
		'viz-slider-tin-isoline-count',
		t('chive-chart-control-tin-isoline-count'),
		Number(config.isolineCount ?? TIN_CHART.defaultIsolineCount),
		TIN_CHART.minIsolineCount,
		TIN_CHART.maxIsolineCount,
		1,
		disabled || !config.showIsolines || isolineMode === 'step',
	));
	overlayControls.push(createNumberInputControl(
		'viz-input-tin-isoline-step',
		t('chive-chart-control-tin-isoline-step'),
		Number.isFinite(Number(config.isolineStep)) && Number(config.isolineStep) > 0
			? Number(config.isolineStep)
			: TIN_CHART.defaultIsolineStep,
		{ min: 0, step: 'any', disabled: disabled || !config.showIsolines || isolineMode === 'count' },
	));
	overlayControls.push(createColorInputControl(
		'viz-input-tin-isoline-color',
		t('chive-chart-control-tin-isoline-color'),
		config.isolineColor,
		TIN_CHART.defaultIsolineColor,
		disabled || !config.showIsolines || config.colorIsolinesByZ === true,
	));
	overlayControls.push(createSliderControl(
		'viz-slider-tin-isoline-width',
		t('chive-chart-control-tin-isoline-width'),
		Number(config.isolineWidth ?? TIN_CHART.defaultIsolineWidth),
		TIN_CHART.minIsolineWidth,
		TIN_CHART.maxIsolineWidth,
		0.1,
		disabled || !config.showIsolines,
	));

	overlayControls.push(createCheckboxControl(
		'viz-toggle-tin-color-isolines-by-z',
		t('chive-chart-control-tin-color-isolines-by-z'),
		config.colorIsolinesByZ === true,
		disabled || !config.showIsolines,
	));
	overlayControls.push(createColorInputControl(
		'viz-input-tin-isoline-min-color',
		t('chive-chart-control-tin-isoline-min-color'),
		config.isolineMinColor,
		TIN_CHART.defaultIsolineMinColor,
		disabled || !config.showIsolines || config.colorIsolinesByZ !== true,
	));
	overlayControls.push(createColorInputControl(
		'viz-input-tin-isoline-max-color',
		t('chive-chart-control-tin-isoline-max-color'),
		config.isolineMaxColor,
		TIN_CHART.defaultIsolineMaxColor,
		disabled || !config.showIsolines || config.colorIsolinesByZ !== true,
	));

	overlayControls.push(createCheckboxControl(
		'viz-toggle-tin-isoline-labels',
		t('chive-chart-control-tin-show-isoline-labels'),
		config.showIsolineLabels,
		disabled || !config.showIsolines,
	));
	overlayControls.push(createSliderControl(
		'viz-slider-tin-isoline-label-size',
		t('chive-chart-control-tin-isoline-label-size'),
		Number(config.isolineLabelSize ?? TIN_CHART.defaultIsolineLabelSize),
		TIN_CHART.minIsolineLabelSize,
		TIN_CHART.maxIsolineLabelSize,
		1,
		disabled || !config.showIsolines || !config.showIsolineLabels,
	));
	overlayControls.push(createColorInputControl(
		'viz-input-tin-isoline-label-color',
		t('chive-chart-control-tin-isoline-label-color'),
		config.isolineLabelColor,
		TIN_CHART.defaultIsolineLabelColor,
		disabled || !config.showIsolines || !config.showIsolineLabels,
	));

	overlayControls.push(createCheckboxControl(
		'viz-toggle-tin-threshold',
		t('chive-chart-control-tin-show-threshold'),
		config.showThreshold === true,
		disabled,
	));
	overlayControls.push(createNumberInputControl(
		'viz-input-tin-threshold-value',
		t('chive-chart-control-tin-threshold-value'),
		Number.isFinite(Number(config.thresholdValue)) ? Number(config.thresholdValue) : TIN_CHART.defaultThresholdValue,
		{ step: 'any', disabled: disabled || !config.showThreshold },
	));
	overlayControls.push(createColorInputControl(
		'viz-input-tin-threshold-color',
		t('chive-chart-control-tin-threshold-color'),
		config.thresholdColor,
		TIN_CHART.defaultThresholdColor,
		disabled || !config.showThreshold,
	));
	overlayControls.push(createSliderControl(
		'viz-slider-tin-threshold-width',
		t('chive-chart-control-tin-threshold-width'),
		Number(config.thresholdWidth ?? TIN_CHART.defaultThresholdWidth),
		TIN_CHART.minThresholdWidth,
		TIN_CHART.maxThresholdWidth,
		0.1,
		disabled || !config.showThreshold,
	));

	return groupControls([
		{ id: 'data', title: 'Data', controls: dataControls, expanded: true, icon: 'data' },
		{ id: 'display', title: 'Display', controls: displayControls, expanded: true, icon: 'display' },
		{ id: 'surface', title: 'Surface', controls: surfaceControls, expanded: false, icon: 'styling' },
		{ id: 'overlays', title: 'Overlays', controls: overlayControls, expanded: false, icon: 'advanced' },
	]);
}

export function setupTinControlListeners(dataset, numericOptions, allColumns, onConfigChanged) {
	void allColumns;
	setupExpandListener('viz-expand-tin', dataset, 'tin', onConfigChanged);

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
	setupSliderListener('viz-slider-tin-height', 'chartHeight', dataset, 'tin', onConfigChanged);
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

function pickPreferred(options, preferredIndex, avoid = []) {
	const filtered = options.filter(opt => !avoid.includes(opt));
	return filtered[preferredIndex] ?? filtered[0] ?? null;
}

export function computeDefaults(dataset, ctx) {
	const config = dataset.configGraficos?.tin || {};
	const numerics = ctx.numericas || [];
	const currentX = numerics.includes(config.x) ? config.x : (numerics[0] ?? null);
	const currentY = numerics.includes(config.y) && config.y !== currentX
		? config.y
		: pickPreferred(numerics, 1, [currentX]) ?? null;
	const currentZ = numerics.includes(config.z) && config.z !== currentX && config.z !== currentY
		? config.z
		: pickPreferred(numerics, 2, [currentX, currentY]) ?? null;
	return { x: currentX, y: currentY, z: currentZ };
}
