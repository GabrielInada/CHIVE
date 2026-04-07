import { CHART_COLORS } from '../../config/charts.js';
import { t } from '../../services/i18nService.js';
import { updateActiveDatasetChartConfig } from '../stateSync.js';
import { createCheckboxControl, createSliderControl, createTextControl, normalizeHexColor } from './shared.js';
import { COLOR_PRESETS, createColorPresetControl } from './shared.js';
import { createChartFilterControls, setupChartFilterControlListeners } from './filterControls.js';

function createSelectControl(id, labelKey, optionsArray, selectedValue, disabled = false) {
	const div = document.createElement('div');
	div.className = 'chart-controle';

	const label = document.createElement('label');
	label.htmlFor = id;
	label.textContent = t(labelKey);

	const select = document.createElement('select');
	select.id = id;
	select.className = 'linhas-select';
	select.disabled = disabled;

	optionsArray.forEach(opt => {
		const option = document.createElement('option');
		option.value = opt.value;
		option.textContent = opt.label;
		option.selected = String(opt.value) === String(selectedValue);
		select.appendChild(option);
	});

	div.appendChild(label);
	div.appendChild(select);
	return div;
}

export function createScatterPlotControls(dataset, numericOptions, allOptions = []) {
	const config = dataset.configGraficos.scatter;
	const controls = [];
	const disabled = !dataset.configGraficos.scatter.enabled;
	const categoryOptions = allOptions.filter(option => !numericOptions.includes(option));

	const xOptions = [
		{ value: '', label: t('chive-chart-option-none') },
		...numericOptions.map(opt => ({ value: opt, label: opt })),
	];
	controls.push(createSelectControl(
		'viz-select-x',
		'chive-chart-control-scatter-x',
		xOptions,
		config.x,
		!dataset.configGraficos.scatter.enabled,
	));

	const yOptions = [
		{ value: '', label: t('chive-chart-option-none') },
		...numericOptions.map(opt => ({ value: opt, label: opt })),
	];
	controls.push(createSelectControl(
		'viz-select-y',
		'chive-chart-control-scatter-y',
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
		'chive-chart-control-scatter-xscale',
		xScaleOptions,
		config.xScale,
		disabled,
	));

	const yScaleOptions = [
		{ value: 'linear', label: t('chive-chart-scale-linear') },
		{ value: 'log', label: t('chive-chart-scale-log') },
	];
	controls.push(createSelectControl(
		'viz-select-scatter-yscale',
		'chive-chart-control-scatter-yscale',
		yScaleOptions,
		config.yScale,
		disabled,
	));

	const radiusOptions = [
		{ value: '2', label: '2' },
		{ value: '3', label: '3' },
		{ value: '4', label: '4' },
		{ value: '6', label: '6' },
	];
	controls.push(createSelectControl(
		'viz-select-scatter-radius',
		'chive-chart-control-scatter-radius',
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
		'chive-chart-control-scatter-opacity',
		opacityOptions,
		config.opacity,
		disabled,
	));

	const colorModeOptions = [
		{ value: 'uniform', label: t('chive-chart-color-uniform') },
		{ value: 'numeric', label: t('chive-chart-color-scatter-numeric') },
		{ value: 'category', label: t('chive-chart-color-scatter-category') },
	];
	controls.push(createSelectControl(
		'viz-select-scatter-color-mode',
		'chive-chart-color-mode',
		colorModeOptions,
		config.colorMode,
		disabled,
	));

	const colorFieldOptions = config.colorMode === 'category'
		? categoryOptions
		: numericOptions;
	controls.push(createSelectControl(
		'viz-select-scatter-color-field',
		'chive-chart-color-scatter-field',
		[
			{ value: '', label: t('chive-chart-option-none') },
			...colorFieldOptions.map(opt => ({ value: opt, label: opt })),
		],
		config.colorField,
		disabled || config.colorMode === 'uniform',
	));

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

	controls.push(createSliderControl(
		'viz-slider-scatter-height',
		t('chive-chart-control-common-height'),
		Number(config.chartHeight || 320),
		220,
		720,
		10,
		disabled
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
	controls.push(colorDiv);

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
	controls.push(minColorDiv);

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
	controls.push(maxColorDiv);

	if (config.colorMode === 'category') {
		controls.push(createSelectControl(
			'viz-select-scatter-color-scheme',
			'chive-chart-color-scheme',
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

	controls.push(...createChartFilterControls({
		chartKey: 'scatter',
		rows: dataset.dados,
		allColumns: allOptions,
		numericColumns: numericOptions,
		rawFilter: config.filter,
		disabled,
	}));

	return controls;
}

export function setupScatterPlotControlListeners(dataset, numericas, allOptions, onConfigChanged) {
	const categoricas = allOptions.filter(option => !numericas.includes(option));
	const toggleScatter = document.getElementById('viz-toggle-scatter');
	const expandScatter = document.getElementById('viz-expand-scatter');

	if (toggleScatter) {
		toggleScatter.addEventListener('change', () => {
			const xAtual = dataset.configGraficos.scatter?.x;
			const yAtual = dataset.configGraficos.scatter?.y;
			const xPadrao = numericas.includes(xAtual) ? xAtual : (numericas[0] || null);
			const yPadrao = numericas.includes(yAtual)
				? yAtual
				: (numericas[1] || numericas[0] || null);
			updateActiveDatasetChartConfig({
				scatter: {
					...dataset.configGraficos.scatter,
					enabled: toggleScatter.checked,
					x: toggleScatter.checked ? xPadrao : xAtual,
					y: toggleScatter.checked ? yPadrao : yAtual,
					expanded: toggleScatter.checked ? true : dataset.configGraficos.scatter?.expanded === true,
				},
			});
			onConfigChanged?.();
		});
	}

	if (expandScatter) {
		expandScatter.addEventListener('click', () => {
			const expanded = expandScatter.getAttribute('aria-expanded') === 'true';
			updateActiveDatasetChartConfig({
				scatter: {
					...dataset.configGraficos.scatter,
					expanded: !expanded,
				},
			});
			onConfigChanged?.();
		});
	}

	const scatterControls = [
		{ id: 'viz-select-x', key: 'x' },
		{ id: 'viz-select-y', key: 'y' },
		{ id: 'viz-select-scatter-xscale', key: 'xScale' },
		{ id: 'viz-select-scatter-yscale', key: 'yScale' },
		{ id: 'viz-select-scatter-radius', key: 'radius', type: 'number' },
		{ id: 'viz-select-scatter-opacity', key: 'opacity', type: 'number' },
		{ id: 'viz-select-scatter-color-mode', key: 'colorMode' },
		{ id: 'viz-select-scatter-color-field', key: 'colorField', toNull: true },
		{ id: 'viz-select-scatter-color-scheme', key: 'colorScheme' },
	];

	scatterControls.forEach(({ id, key, type, toNull }) => {
		const select = document.getElementById(id);
		if (select) {
			select.addEventListener('change', () => {
				const value = type === 'number' ? Number(select.value) : select.value;
				let nextValue = toNull ? (value || null) : value;

				if (key === 'colorMode') {
					const availableFields = value === 'category' ? categoricas : numericas;
					const currentField = dataset.configGraficos.scatter.colorField;
					nextValue = value === 'uniform' ? 'uniform' : value;
					updateActiveDatasetChartConfig({
						scatter: {
							...dataset.configGraficos.scatter,
							colorMode: nextValue,
							colorField: value === 'uniform'
								? null
								: (availableFields.includes(currentField) ? currentField : (availableFields[0] || null)),
							colorFieldType: value === 'category' ? 'category' : (value === 'numeric' ? 'numeric' : null),
						},
					});
					onConfigChanged?.();
					return;
				}

				updateActiveDatasetChartConfig({
					scatter: {
						...dataset.configGraficos.scatter,
						[key]: nextValue,
					},
				});
				onConfigChanged?.();
			});
		}
	});

	const inputScatterColor = document.getElementById('viz-input-scatter-color');
	if (inputScatterColor) {
		const applyManualScatterColor = () => {
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
		};
		inputScatterColor.addEventListener('input', applyManualScatterColor);
		inputScatterColor.addEventListener('change', applyManualScatterColor);
	}

	const inputScatterGradientMin = document.getElementById('viz-input-scatter-gradient-min');
	if (inputScatterGradientMin) {
		inputScatterGradientMin.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				scatter: {
					...dataset.configGraficos.scatter,
					gradientMinColor: normalizeHexColor(inputScatterGradientMin.value, CHART_COLORS.scatter),
				},
			});
			onConfigChanged?.();
		});
	}

	const inputScatterGradientMax = document.getElementById('viz-input-scatter-gradient-max');
	if (inputScatterGradientMax) {
		inputScatterGradientMax.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				scatter: {
					...dataset.configGraficos.scatter,
					gradientMaxColor: normalizeHexColor(inputScatterGradientMax.value, '#ffffff'),
				},
			});
			onConfigChanged?.();
		});
	}

	const scatterPresetButtons = document.querySelectorAll('button[data-color-preset-control="viz-scatter-color-preset"]');
	scatterPresetButtons.forEach(button => {
		button.addEventListener('click', () => {
			const presetName = button.dataset.presetName;
			const palette = COLOR_PRESETS[presetName] || [];
			if (palette.length === 0) return;

			updateActiveDatasetChartConfig({
				scatter: {
					...dataset.configGraficos.scatter,
					colorScheme: presetName,
					color: normalizeHexColor(palette[0], CHART_COLORS.scatter),
					gradientMinColor: normalizeHexColor(palette[0], CHART_COLORS.scatter),
					gradientMaxColor: normalizeHexColor(palette[palette.length - 1], '#ffffff'),
				},
			});
			onConfigChanged?.();
		});
	});

	const toggleScatterXLabel = document.getElementById('viz-toggle-scatter-x-label');
	if (toggleScatterXLabel) {
		toggleScatterXLabel.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				scatter: {
					...dataset.configGraficos.scatter,
					showXAxisLabel: toggleScatterXLabel.checked,
				},
			});
			onConfigChanged?.();
		});
	}

	const toggleScatterYLabel = document.getElementById('viz-toggle-scatter-y-label');
	if (toggleScatterYLabel) {
		toggleScatterYLabel.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				scatter: {
					...dataset.configGraficos.scatter,
					showYAxisLabel: toggleScatterYLabel.checked,
				},
			});
			onConfigChanged?.();
		});
	}

	const inputScatterTitle = document.getElementById('viz-input-scatter-title');
	if (inputScatterTitle) {
		inputScatterTitle.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				scatter: {
					...dataset.configGraficos.scatter,
					customTitle: String(inputScatterTitle.value || '').trim(),
				},
			});
			onConfigChanged?.();
		});
	}

	const sliderScatterHeight = document.getElementById('viz-slider-scatter-height');
	if (sliderScatterHeight) {
		const syncOutput = () => {
			const output = sliderScatterHeight.parentElement?.querySelector('output');
			if (output) output.textContent = sliderScatterHeight.value;
		};
		sliderScatterHeight.addEventListener('input', syncOutput);
		sliderScatterHeight.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				scatter: {
					...dataset.configGraficos.scatter,
					chartHeight: Number(sliderScatterHeight.value),
				},
			});
			onConfigChanged?.();
		});
	}

	setupChartFilterControlListeners({
		chartKey: 'scatter',
		rows: dataset.dados,
		numericColumns: numericas,
		rawFilter: dataset.configGraficos.scatter?.filter,
		onFilterChange: nextFilter => {
			updateActiveDatasetChartConfig({
				scatter: {
					...dataset.configGraficos.scatter,
					filter: nextFilter,
				},
			});
			onConfigChanged?.();
		},
	});
}
