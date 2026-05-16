import { CHART_COLORS, TIN_CHART } from '../../config/charts.js';
import { t } from '../../services/i18nService.js';
import {
	createCheckboxControl,
	createSelectControl,
	createSliderControl,
	createTextControl,
	createColorPresetControl,
	COLOR_PRESETS,
	normalizeHexColor,
} from './shared.js';
import { groupControls } from './controlGrouping.js';
import {
	setupExpandListener,
	setupSelectListeners,
	setupCheckboxListeners,
	setupTextInputListener,
	setupColorInputListener,
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
	surfaceControls.push(createSliderControl(
		'viz-slider-tin-subdivision',
		t('chive-chart-control-tin-subdivision'),
		Number(config.subdivisionDepth ?? TIN_CHART.defaultSubdivisionDepth),
		TIN_CHART.minSubdivisionDepth,
		TIN_CHART.maxSubdivisionDepth,
		1,
		disabled,
	));

	const minColorDiv = document.createElement('div');
	minColorDiv.className = 'chart-controle';
	const minColorLabel = document.createElement('label');
	minColorLabel.htmlFor = 'viz-input-tin-gradient-min';
	minColorLabel.textContent = t('chive-chart-color-gradient-min');
	const minColorInput = document.createElement('input');
	minColorInput.id = 'viz-input-tin-gradient-min';
	minColorInput.type = 'color';
	minColorInput.className = 'chart-color-input';
	minColorInput.value = normalizeHexColor(config.gradientMinColor, CHART_COLORS.tin);
	minColorInput.disabled = disabled;
	minColorDiv.appendChild(minColorLabel);
	minColorDiv.appendChild(minColorInput);
	surfaceControls.push(minColorDiv);

	const maxColorDiv = document.createElement('div');
	maxColorDiv.className = 'chart-controle';
	const maxColorLabel = document.createElement('label');
	maxColorLabel.htmlFor = 'viz-input-tin-gradient-max';
	maxColorLabel.textContent = t('chive-chart-color-gradient-max');
	const maxColorInput = document.createElement('input');
	maxColorInput.id = 'viz-input-tin-gradient-max';
	maxColorInput.type = 'color';
	maxColorInput.className = 'chart-color-input';
	maxColorInput.value = normalizeHexColor(config.gradientMaxColor, '#ffffff');
	maxColorInput.disabled = disabled;
	maxColorDiv.appendChild(maxColorLabel);
	maxColorDiv.appendChild(maxColorInput);
	surfaceControls.push(maxColorDiv);

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
		disabled,
	));

	const overlayControls = [];
	overlayControls.push(createCheckboxControl(
		'viz-toggle-tin-edges',
		t('chive-chart-control-tin-show-edges'),
		config.showEdges,
		disabled,
	));
	const edgeColorDiv = document.createElement('div');
	edgeColorDiv.className = 'chart-controle';
	const edgeColorLabel = document.createElement('label');
	edgeColorLabel.htmlFor = 'viz-input-tin-edge-color';
	edgeColorLabel.textContent = t('chive-chart-control-tin-edge-color');
	const edgeColorInput = document.createElement('input');
	edgeColorInput.id = 'viz-input-tin-edge-color';
	edgeColorInput.type = 'color';
	edgeColorInput.className = 'chart-color-input';
	edgeColorInput.value = normalizeHexColor(config.edgeColor, TIN_CHART.defaultEdgeColor);
	edgeColorInput.disabled = disabled || !config.showEdges;
	edgeColorDiv.appendChild(edgeColorLabel);
	edgeColorDiv.appendChild(edgeColorInput);
	overlayControls.push(edgeColorDiv);

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
	const hullColorDiv = document.createElement('div');
	hullColorDiv.className = 'chart-controle';
	const hullColorLabel = document.createElement('label');
	hullColorLabel.htmlFor = 'viz-input-tin-hull-color';
	hullColorLabel.textContent = t('chive-chart-control-tin-hull-color');
	const hullColorInput = document.createElement('input');
	hullColorInput.id = 'viz-input-tin-hull-color';
	hullColorInput.type = 'color';
	hullColorInput.className = 'chart-color-input';
	hullColorInput.value = normalizeHexColor(config.hullColor, TIN_CHART.defaultHullColor);
	hullColorInput.disabled = disabled || !config.showHull;
	hullColorDiv.appendChild(hullColorLabel);
	hullColorDiv.appendChild(hullColorInput);
	overlayControls.push(hullColorDiv);

	overlayControls.push(createCheckboxControl(
		'viz-toggle-tin-isolines',
		t('chive-chart-control-tin-show-isolines'),
		config.showIsolines,
		disabled,
	));
	overlayControls.push(createSliderControl(
		'viz-slider-tin-isoline-count',
		t('chive-chart-control-tin-isoline-count'),
		Number(config.isolineCount ?? TIN_CHART.defaultIsolineCount),
		TIN_CHART.minIsolineCount,
		TIN_CHART.maxIsolineCount,
		1,
		disabled || !config.showIsolines,
	));
	const isolineColorDiv = document.createElement('div');
	isolineColorDiv.className = 'chart-controle';
	const isolineColorLabel = document.createElement('label');
	isolineColorLabel.htmlFor = 'viz-input-tin-isoline-color';
	isolineColorLabel.textContent = t('chive-chart-control-tin-isoline-color');
	const isolineColorInput = document.createElement('input');
	isolineColorInput.id = 'viz-input-tin-isoline-color';
	isolineColorInput.type = 'color';
	isolineColorInput.className = 'chart-color-input';
	isolineColorInput.value = normalizeHexColor(config.isolineColor, TIN_CHART.defaultIsolineColor);
	isolineColorInput.disabled = disabled || !config.showIsolines;
	isolineColorDiv.appendChild(isolineColorLabel);
	isolineColorDiv.appendChild(isolineColorInput);
	overlayControls.push(isolineColorDiv);
	overlayControls.push(createSliderControl(
		'viz-slider-tin-isoline-width',
		t('chive-chart-control-tin-isoline-width'),
		Number(config.isolineWidth ?? TIN_CHART.defaultIsolineWidth),
		TIN_CHART.minIsolineWidth,
		TIN_CHART.maxIsolineWidth,
		0.1,
		disabled || !config.showIsolines,
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
	], dataset, 'tin', onConfigChanged);

	setupCheckboxListeners([
		{ id: 'viz-toggle-tin-x-label', key: 'showXAxisLabel' },
		{ id: 'viz-toggle-tin-y-label', key: 'showYAxisLabel' },
		{ id: 'viz-toggle-tin-edges', key: 'showEdges' },
		{ id: 'viz-toggle-tin-points', key: 'showPoints' },
		{ id: 'viz-toggle-tin-z-labels', key: 'showZLabels' },
		{ id: 'viz-toggle-tin-hull', key: 'showHull' },
		{ id: 'viz-toggle-tin-isolines', key: 'showIsolines' },
	], dataset, 'tin', onConfigChanged);

	setupTextInputListener('viz-input-tin-title', 'customTitle', dataset, 'tin', onConfigChanged);
	setupSliderListener('viz-slider-tin-height', 'chartHeight', dataset, 'tin', onConfigChanged);
	setupSliderListener('viz-slider-tin-subdivision', 'subdivisionDepth', dataset, 'tin', onConfigChanged);
	setupSliderListener('viz-slider-tin-point-radius', 'pointRadius', dataset, 'tin', onConfigChanged);
	setupSliderListener('viz-slider-tin-isoline-count', 'isolineCount', dataset, 'tin', onConfigChanged);
	setupSliderListener('viz-slider-tin-isoline-width', 'isolineWidth', dataset, 'tin', onConfigChanged);

	setupColorInputListener('viz-input-tin-gradient-min', 'gradientMinColor', CHART_COLORS.tin, dataset, 'tin', onConfigChanged);
	setupColorInputListener('viz-input-tin-gradient-max', 'gradientMaxColor', '#ffffff', dataset, 'tin', onConfigChanged);
	setupColorInputListener('viz-input-tin-edge-color', 'edgeColor', TIN_CHART.defaultEdgeColor, dataset, 'tin', onConfigChanged);
	setupColorInputListener('viz-input-tin-hull-color', 'hullColor', TIN_CHART.defaultHullColor, dataset, 'tin', onConfigChanged);
	setupColorInputListener('viz-input-tin-isoline-color', 'isolineColor', TIN_CHART.defaultIsolineColor, dataset, 'tin', onConfigChanged);

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
