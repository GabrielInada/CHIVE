import { CHART_COLORS } from '../../config/charts.js';
import { t } from '../../services/i18nService.js';
import { updateActiveDatasetChartConfig } from '../stateSync.js';
import { createCheckboxControl, createSliderControl, createTextControl, normalizeHexColor, createSelectControl } from './shared.js';
import { COLOR_PRESETS, createColorPresetControl } from './shared.js';
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
import { triggerLiveRender } from './livePreview.js';

export function createScatterPlotControls(dataset, numericOptions, allOptions = []) {
	const config = dataset.configGraficos.scatter;
	const disabled = !dataset.configGraficos.scatter.enabled;
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

	displayControls.push(createSliderControl(
		'viz-slider-scatter-height',
		t('chive-chart-control-common-height'),
		Number(config.chartHeight || 320),
		220,
		720,
		10,
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

	const colorDiv = document.createElement('div');
	colorDiv.className = 'chart-controle';

	const colorLabel = document.createElement('label');
	colorLabel.htmlFor = 'viz-input-scatter-color';
	colorLabel.textContent = t('chive-chart-control-scatter-color');

	const colorInput = document.createElement('input');
	colorInput.id = 'viz-input-scatter-color';
	colorInput.type = 'color';
	colorInput.className = 'chart-color-input';
	colorInput.value = normalizeHexColor(config.color, CHART_COLORS.scatter);
	colorInput.disabled = disabled || config.colorMode !== 'uniform';

	colorDiv.appendChild(colorLabel);
	colorDiv.appendChild(colorInput);
	stylingControls.push(colorDiv);

	const minColorDiv = document.createElement('div');
	minColorDiv.className = 'chart-controle';
	const minColorLabel = document.createElement('label');
	minColorLabel.htmlFor = 'viz-input-scatter-gradient-min';
	minColorLabel.textContent = t('chive-chart-color-gradient-min');
	const minColorInput = document.createElement('input');
	minColorInput.id = 'viz-input-scatter-gradient-min';
	minColorInput.type = 'color';
	minColorInput.className = 'chart-color-input';
	minColorInput.value = normalizeHexColor(config.gradientMinColor, CHART_COLORS.scatter);
	minColorInput.disabled = disabled || config.colorMode === 'uniform';
	minColorDiv.appendChild(minColorLabel);
	minColorDiv.appendChild(minColorInput);
	stylingControls.push(minColorDiv);

	const maxColorDiv = document.createElement('div');
	maxColorDiv.className = 'chart-controle';
	const maxColorLabel = document.createElement('label');
	maxColorLabel.htmlFor = 'viz-input-scatter-gradient-max';
	maxColorLabel.textContent = t('chive-chart-color-gradient-max');
	const maxColorInput = document.createElement('input');
	maxColorInput.id = 'viz-input-scatter-gradient-max';
	maxColorInput.type = 'color';
	maxColorInput.className = 'chart-color-input';
	maxColorInput.value = normalizeHexColor(config.gradientMaxColor, '#ffffff');
	maxColorInput.disabled = disabled || config.colorMode === 'uniform';
	maxColorDiv.appendChild(maxColorLabel);
	maxColorDiv.appendChild(maxColorInput);
	stylingControls.push(maxColorDiv);

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

	// ====== Group and return all sections ======
	return groupControls([
		{ id: 'data', title: 'Data & Aggregation', controls: dataControls, expanded: true, icon: 'data' },
		{ id: 'display', title: 'Display', controls: displayControls, expanded: true, icon: 'display' },
		{ id: 'styling', title: 'Styling', controls: stylingControls, expanded: false, icon: 'styling' },
	]);
}

export function setupScatterPlotControlListeners(dataset, numericas, allOptions, onConfigChanged) {
	const categoricas = allOptions.filter(option => !numericas.includes(option));
	const pickPreferredAxis = (current, preferredIndex = 0, avoid = null) => {
		if (allOptions.includes(current) && current !== avoid) return current;
		const preferred = numericas.filter(option => allOptions.includes(option) && option !== avoid);
		if (preferred[preferredIndex]) return preferred[preferredIndex];
		return allOptions.find(option => option !== avoid) || null;
	};

	const toggleScatter = document.getElementById('viz-toggle-scatter');
	const expandScatter = document.getElementById('viz-expand-scatter');

	if (toggleScatter) {
		toggleScatter.addEventListener('change', () => {
			const xAtual = dataset.configGraficos.scatter?.x;
			const yAtual = dataset.configGraficos.scatter?.y;
			const xPadrao = pickPreferredAxis(xAtual, 0, null);
			const yPadrao = pickPreferredAxis(yAtual, 1, xPadrao) || xPadrao;
			const currentXScale = dataset.configGraficos.scatter?.xScale === 'log' ? 'log' : 'linear';
			const currentYScale = dataset.configGraficos.scatter?.yScale === 'log' ? 'log' : 'linear';
			const xScale = numericas.includes(xPadrao) ? currentXScale : 'linear';
			const yScale = numericas.includes(yPadrao) ? currentYScale : 'linear';
			updateActiveDatasetChartConfig({
				scatter: {
					...dataset.configGraficos.scatter,
					enabled: toggleScatter.checked,
					x: toggleScatter.checked ? xPadrao : xAtual,
					y: toggleScatter.checked ? yPadrao : yAtual,
					xScale,
					yScale,
					expanded: toggleScatter.checked ? true : dataset.configGraficos.scatter?.expanded === true,
				},
			});
			onConfigChanged?.();
		});
	}

	setupExpandListener('viz-expand-scatter', dataset, 'scatter', onConfigChanged);

	const attachAxisListener = (selectId, axisKey, scaleKey) => {
		const select = document.getElementById(selectId);
		if (!select) return;
		select.addEventListener('change', () => {
			const selected = allOptions.includes(select.value) ? select.value : null;
			const currentScale = dataset.configGraficos.scatter?.[scaleKey] === 'log' ? 'log' : 'linear';
			updateActiveDatasetChartConfig({
				scatter: {
					...dataset.configGraficos.scatter,
					[axisKey]: selected,
					[scaleKey]: numericas.includes(selected) ? currentScale : 'linear',
				},
			});
			onConfigChanged?.();
		});
	};

	attachAxisListener('viz-select-x', 'x', 'xScale');
	attachAxisListener('viz-select-y', 'y', 'yScale');

	// Simple selects (no cross-dependency logic)
	setupSelectListeners([
		{
			id: 'viz-select-scatter-xscale',
			key: 'xScale',
			transform: v => (numericas.includes(dataset.configGraficos.scatter?.x) && v === 'log' ? 'log' : 'linear'),
		},
		{
			id: 'viz-select-scatter-yscale',
			key: 'yScale',
			transform: v => (numericas.includes(dataset.configGraficos.scatter?.y) && v === 'log' ? 'log' : 'linear'),
		},
		{ id: 'viz-select-scatter-radius', key: 'radius', transform: v => Number(v) },
		{ id: 'viz-select-scatter-opacity', key: 'opacity', transform: v => Number(v) },
		{
			id: 'viz-select-scatter-categorical-mode',
			key: 'categoricalPairMode',
			transform: value => (value === 'aggregate' ? 'aggregate' : 'jitter'),
		},
		{ id: 'viz-select-scatter-color-field', key: 'colorField', transform: v => v || null },
		{ id: 'viz-select-scatter-color-scheme', key: 'colorScheme' },
	], dataset, 'scatter', onConfigChanged);

	// colorMode needs custom logic (updates colorField/colorFieldType)
	const colorModeSelect = document.getElementById('viz-select-scatter-color-mode');
	if (colorModeSelect) {
		colorModeSelect.addEventListener('change', () => {
			const value = colorModeSelect.value;
			const availableFields = value === 'category' ? categoricas : numericas;
			const currentField = dataset.configGraficos.scatter.colorField;
			updateActiveDatasetChartConfig({
				scatter: {
					...dataset.configGraficos.scatter,
					colorMode: value === 'uniform' ? 'uniform' : value,
					colorField: value === 'uniform'
						? null
						: (availableFields.includes(currentField) ? currentField : (availableFields[0] || null)),
					colorFieldType: value === 'category' ? 'category' : (value === 'numeric' ? 'numeric' : null),
				},
			});
			onConfigChanged?.();
		});
	}

	// Scatter color input (custom: sets colorMode to uniform)
	const inputScatterColor = document.getElementById('viz-input-scatter-color');
	if (inputScatterColor) {
		inputScatterColor.addEventListener('input', () => {
			const scatterConfig = dataset.configGraficos.scatter;
			scatterConfig.colorMode = 'uniform';
			scatterConfig.colorField = null;
			scatterConfig.colorFieldType = null;
			scatterConfig.color = normalizeHexColor(inputScatterColor.value, CHART_COLORS.scatter);
			triggerLiveRender();
		});
		inputScatterColor.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				scatter: {
					...dataset.configGraficos.scatter,
					colorMode: 'uniform',
					colorField: null,
					colorFieldType: null,
					color: normalizeHexColor(inputScatterColor.value, CHART_COLORS.scatter),
				},
			});
			onConfigChanged?.();
		});
	}

	setupColorInputListener('viz-input-scatter-gradient-min', 'gradientMinColor', CHART_COLORS.scatter, dataset, 'scatter', onConfigChanged);
	setupColorInputListener('viz-input-scatter-gradient-max', 'gradientMaxColor', '#ffffff', dataset, 'scatter', onConfigChanged);
	setupSelectListeners([
		{ id: 'viz-select-scatter-gradient-distribution', key: 'gradientDistribution', transform: v =>
			['value', 'rank'].includes(v) ? v : 'value' },
	], dataset, 'scatter', onConfigChanged);

	setupColorPresetListeners('viz-scatter-color-preset', {
		color: 0, gradientMinColor: 0, gradientMaxColor: -1,
	}, {
		color: CHART_COLORS.scatter, gradientMinColor: CHART_COLORS.scatter, gradientMaxColor: '#ffffff',
	}, dataset, 'scatter', onConfigChanged, COLOR_PRESETS);

	setupCheckboxListeners([
		{ id: 'viz-toggle-scatter-x-label', key: 'showXAxisLabel' },
		{ id: 'viz-toggle-scatter-y-label', key: 'showYAxisLabel' },
	], dataset, 'scatter', onConfigChanged);

	setupTextInputListener('viz-input-scatter-title', 'customTitle', dataset, 'scatter', onConfigChanged);
	setupSliderListener('viz-slider-scatter-height', 'chartHeight', dataset, 'scatter', onConfigChanged);
}
