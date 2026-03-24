import { CHART_COLORS } from '../../config/charts.js';
import { t } from '../../services/i18nService.js';
import { updateActiveDatasetChartConfig } from '../stateSync.js';
import { createCheckboxControl, createSliderControl, createTextControl, normalizeHexColor } from './shared.js';
import { COLOR_PRESETS, createColorPresetControl } from './shared.js';

function createSelectControl(id, labelText, optionsArray, selectedValue, disabled = false) {
	const div = document.createElement('div');
	div.className = 'chart-controle';

	const label = document.createElement('label');
	label.htmlFor = id;
	label.textContent = labelText;

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

export function createBarChartControls(dataset, categoryOptions) {
	const config = dataset.configGraficos.bar;
	const controls = [];

	const categoryDiv = document.createElement('div');
	categoryDiv.className = 'chart-controle';

	const categoryLabel = document.createElement('label');
	categoryLabel.htmlFor = 'viz-select-bar';
	categoryLabel.textContent = t('chive-chart-control-bar-category');

	const categorySelect = document.createElement('select');
	categorySelect.id = 'viz-select-bar';
	categorySelect.className = 'linhas-select';
	categorySelect.disabled = !dataset.configGraficos.bar.enabled;

	const noneOption = document.createElement('option');
	noneOption.value = '';
	noneOption.textContent = t('chive-chart-option-none');
	categorySelect.appendChild(noneOption);

	categoryOptions.forEach(opt => {
		const option = document.createElement('option');
		option.value = opt;
		option.textContent = opt;
		option.selected = opt === config.category;
		categorySelect.appendChild(option);
	});

	categoryDiv.appendChild(categoryLabel);
	categoryDiv.appendChild(categorySelect);
	controls.push(categoryDiv);

	const sortDiv = document.createElement('div');
	sortDiv.className = 'chart-controle';

	const sortLabel = document.createElement('label');
	sortLabel.htmlFor = 'viz-select-bar-sort';
	sortLabel.textContent = t('chive-chart-control-bar-sort');

	const sortSelect = document.createElement('select');
	sortSelect.id = 'viz-select-bar-sort';
	sortSelect.className = 'linhas-select';
	sortSelect.disabled = !dataset.configGraficos.bar.enabled;

	const sortOptions = [
		{ value: 'count-desc', label: t('chive-chart-sort-count-desc') },
		{ value: 'count-asc', label: t('chive-chart-sort-count-asc') },
		{ value: 'label-asc', label: t('chive-chart-sort-label-asc') },
		{ value: 'label-desc', label: t('chive-chart-sort-label-desc') },
	];

	sortOptions.forEach(opt => {
		const option = document.createElement('option');
		option.value = opt.value;
		option.textContent = opt.label;
		option.selected = opt.value === config.sort;
		sortSelect.appendChild(option);
	});

	sortDiv.appendChild(sortLabel);
	sortDiv.appendChild(sortSelect);
	controls.push(sortDiv);

	const topnDiv = document.createElement('div');
	topnDiv.className = 'chart-controle';

	const topnLabel = document.createElement('label');
	topnLabel.htmlFor = 'viz-select-bar-topn';
	topnLabel.textContent = t('chive-chart-control-bar-topn');

	const topnSelect = document.createElement('select');
	topnSelect.id = 'viz-select-bar-topn';
	topnSelect.className = 'linhas-select';
	topnSelect.disabled = !dataset.configGraficos.bar.enabled;

	const topnOptions = [
		{ value: '0', label: t('chive-chart-topn-all') },
		{ value: '10', label: 'Top 10' },
		{ value: '20', label: 'Top 20' },
		{ value: '50', label: 'Top 50' },
	];

	topnOptions.forEach(opt => {
		const option = document.createElement('option');
		option.value = opt.value;
		option.textContent = opt.label;
		option.selected = String(config.topN) === opt.value;
		topnSelect.appendChild(option);
	});

	topnDiv.appendChild(topnLabel);
	topnDiv.appendChild(topnSelect);
	controls.push(topnDiv);

	controls.push(createCheckboxControl(
		'viz-toggle-bar-x-label',
		t('chive-chart-control-axis-label-x'),
		config.showXAxisLabel,
		!dataset.configGraficos.bar.enabled
	));

	controls.push(createCheckboxControl(
		'viz-toggle-bar-y-label',
		t('chive-chart-control-axis-label-y'),
		config.showYAxisLabel,
		!dataset.configGraficos.bar.enabled
	));

	controls.push(createTextControl(
		'viz-input-bar-title',
		t('chive-chart-control-common-title'),
		config.customTitle,
		80,
		!dataset.configGraficos.bar.enabled
	));

	controls.push(createSliderControl(
		'viz-slider-bar-height',
		t('chive-chart-control-common-height'),
		Number(config.chartHeight || 320),
		220,
		720,
		10,
		!dataset.configGraficos.bar.enabled
	));

	controls.push(createSelectControl(
		'viz-select-bar-color-mode',
		t('chive-chart-color-mode'),
		[
			{ value: 'uniform', label: t('chive-chart-color-uniform') },
			{ value: 'gradient', label: t('chive-chart-color-gradient') },
			{ value: 'gradient-manual', label: t('chive-chart-color-gradient-manual') },
		],
		config.colorMode,
		!dataset.configGraficos.bar.enabled
	));

	const colorDiv = document.createElement('div');
	colorDiv.className = 'chart-controle';

	const colorLabel = document.createElement('label');
	colorLabel.htmlFor = 'viz-input-bar-color';
	colorLabel.textContent = t('chive-chart-control-bar-color');

	const colorInput = document.createElement('input');
	colorInput.id = 'viz-input-bar-color';
	colorInput.type = 'color';
	colorInput.className = 'chart-color-input';
	colorInput.value = normalizeHexColor(config.color, CHART_COLORS.bar);
	colorInput.disabled = !dataset.configGraficos.bar.enabled || config.colorMode !== 'uniform';

	colorDiv.appendChild(colorLabel);
	colorDiv.appendChild(colorInput);
	controls.push(colorDiv);

	const minColorDiv = document.createElement('div');
	minColorDiv.className = 'chart-controle';
	const minColorLabel = document.createElement('label');
	minColorLabel.htmlFor = 'viz-input-bar-gradient-min';
	minColorLabel.textContent = t('chive-chart-color-gradient-min');
	const minColorInput = document.createElement('input');
	minColorInput.id = 'viz-input-bar-gradient-min';
	minColorInput.type = 'color';
	minColorInput.className = 'chart-color-input';
	minColorInput.value = normalizeHexColor(config.gradientMinColor, CHART_COLORS.bar);
	minColorInput.disabled = !dataset.configGraficos.bar.enabled || config.colorMode === 'uniform';
	minColorDiv.appendChild(minColorLabel);
	minColorDiv.appendChild(minColorInput);
	controls.push(minColorDiv);

	const maxColorDiv = document.createElement('div');
	maxColorDiv.className = 'chart-controle';
	const maxColorLabel = document.createElement('label');
	maxColorLabel.htmlFor = 'viz-input-bar-gradient-max';
	maxColorLabel.textContent = t('chive-chart-color-gradient-max');
	const maxColorInput = document.createElement('input');
	maxColorInput.id = 'viz-input-bar-gradient-max';
	maxColorInput.type = 'color';
	maxColorInput.className = 'chart-color-input';
	maxColorInput.value = normalizeHexColor(config.gradientMaxColor, '#ffffff');
	maxColorInput.disabled = !dataset.configGraficos.bar.enabled || config.colorMode === 'uniform';
	maxColorDiv.appendChild(maxColorLabel);
	maxColorDiv.appendChild(maxColorInput);
	controls.push(maxColorDiv);

	if (config.colorMode === 'gradient-manual') {
		controls.push(createSliderControl(
			'viz-slider-bar-threshold',
			t('chive-chart-color-threshold'),
			Number(config.manualThresholdPct || 50),
			0,
			100,
			5,
			!dataset.configGraficos.bar.enabled
		));
	}

	controls.push(createColorPresetControl(
		'viz-bar-color-preset',
		t('chive-chart-color-palette'),
		config.colorScheme || 'Bold',
		!dataset.configGraficos.bar.enabled
	));

	return controls;
}

export function setupBarChartControlListeners(dataset, baseBar, onConfigChanged) {
	const toggleBar = document.getElementById('viz-toggle-bar');
	const expandBar = document.getElementById('viz-expand-bar');

	if (toggleBar) {
		toggleBar.addEventListener('change', () => {
			const categoriaAtual = dataset.configGraficos.bar?.category;
			const categoriaPadrao = baseBar.includes(categoriaAtual)
				? categoriaAtual
				: (baseBar[0] || null);
			updateActiveDatasetChartConfig({
				bar: {
					...dataset.configGraficos.bar,
					enabled: toggleBar.checked,
					category: toggleBar.checked ? categoriaPadrao : categoriaAtual,
					expanded: toggleBar.checked ? true : dataset.configGraficos.bar?.expanded === true,
				},
			});
			onConfigChanged?.();
		});
	}

	if (expandBar) {
		expandBar.addEventListener('click', () => {
			const expanded = expandBar.getAttribute('aria-expanded') === 'true';
			updateActiveDatasetChartConfig({
				bar: {
					...dataset.configGraficos.bar,
					expanded: !expanded,
				},
			});
			onConfigChanged?.();
		});
	}

	const selectBar = document.getElementById('viz-select-bar');
	if (selectBar) {
		selectBar.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				bar: {
					...dataset.configGraficos.bar,
					category: selectBar.value,
				},
			});
			onConfigChanged?.();
		});
	}

	const selectBarSort = document.getElementById('viz-select-bar-sort');
	if (selectBarSort) {
		selectBarSort.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				bar: {
					...dataset.configGraficos.bar,
					sort: selectBarSort.value,
				},
			});
			onConfigChanged?.();
		});
	}

	const selectBarTopN = document.getElementById('viz-select-bar-topn');
	if (selectBarTopN) {
		selectBarTopN.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				bar: {
					...dataset.configGraficos.bar,
					topN: Number(selectBarTopN.value),
				},
			});
			onConfigChanged?.();
		});
	}

	const inputBarColor = document.getElementById('viz-input-bar-color');
	if (inputBarColor) {
		inputBarColor.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				bar: {
					...dataset.configGraficos.bar,
					color: normalizeHexColor(inputBarColor.value, CHART_COLORS.bar),
				},
			});
			onConfigChanged?.();
		});
	}

	const selectBarColorMode = document.getElementById('viz-select-bar-color-mode');
	if (selectBarColorMode) {
		selectBarColorMode.addEventListener('change', () => {
			const nextMode = ['uniform', 'gradient', 'gradient-manual'].includes(selectBarColorMode.value)
				? selectBarColorMode.value
				: 'uniform';
			updateActiveDatasetChartConfig({
				bar: {
					...dataset.configGraficos.bar,
					colorMode: nextMode,
				},
			});
			onConfigChanged?.();
		});
	}

	const inputBarGradientMin = document.getElementById('viz-input-bar-gradient-min');
	if (inputBarGradientMin) {
		inputBarGradientMin.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				bar: {
					...dataset.configGraficos.bar,
					gradientMinColor: normalizeHexColor(inputBarGradientMin.value, CHART_COLORS.bar),
				},
			});
			onConfigChanged?.();
		});
	}

	const inputBarGradientMax = document.getElementById('viz-input-bar-gradient-max');
	if (inputBarGradientMax) {
		inputBarGradientMax.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				bar: {
					...dataset.configGraficos.bar,
					gradientMaxColor: normalizeHexColor(inputBarGradientMax.value, '#ffffff'),
				},
			});
			onConfigChanged?.();
		});
	}

	const sliderBarThreshold = document.getElementById('viz-slider-bar-threshold');
	if (sliderBarThreshold) {
		const syncOutput = () => {
			const output = sliderBarThreshold.parentElement?.querySelector('output');
			if (output) output.textContent = sliderBarThreshold.value;
		};
		sliderBarThreshold.addEventListener('input', syncOutput);
		sliderBarThreshold.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				bar: {
					...dataset.configGraficos.bar,
					manualThresholdPct: Number(sliderBarThreshold.value),
				},
			});
			onConfigChanged?.();
		});
	}

	const barPresetButtons = document.querySelectorAll('button[data-color-preset-control="viz-bar-color-preset"]');
	barPresetButtons.forEach(button => {
		button.addEventListener('click', () => {
			const presetName = button.dataset.presetName;
			const palette = COLOR_PRESETS[presetName] || [];
			if (palette.length === 0) return;
			updateActiveDatasetChartConfig({
				bar: {
					...dataset.configGraficos.bar,
					colorScheme: presetName,
					color: normalizeHexColor(palette[0], CHART_COLORS.bar),
					gradientMinColor: normalizeHexColor(palette[0], CHART_COLORS.bar),
					gradientMaxColor: normalizeHexColor(palette[palette.length - 1], '#ffffff'),
				},
			});
			onConfigChanged?.();
		});
	});

	const toggleBarXLabel = document.getElementById('viz-toggle-bar-x-label');
	if (toggleBarXLabel) {
		toggleBarXLabel.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				bar: {
					...dataset.configGraficos.bar,
					showXAxisLabel: toggleBarXLabel.checked,
				},
			});
			onConfigChanged?.();
		});
	}

	const toggleBarYLabel = document.getElementById('viz-toggle-bar-y-label');
	if (toggleBarYLabel) {
		toggleBarYLabel.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				bar: {
					...dataset.configGraficos.bar,
					showYAxisLabel: toggleBarYLabel.checked,
				},
			});
			onConfigChanged?.();
		});
	}

	const inputBarTitle = document.getElementById('viz-input-bar-title');
	if (inputBarTitle) {
		inputBarTitle.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				bar: {
					...dataset.configGraficos.bar,
					customTitle: String(inputBarTitle.value || '').trim(),
				},
			});
			onConfigChanged?.();
		});
	}

	const sliderBarHeight = document.getElementById('viz-slider-bar-height');
	if (sliderBarHeight) {
		const syncOutput = () => {
			const output = sliderBarHeight.parentElement?.querySelector('output');
			if (output) output.textContent = sliderBarHeight.value;
		};
		sliderBarHeight.addEventListener('input', syncOutput);
		sliderBarHeight.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				bar: {
					...dataset.configGraficos.bar,
					chartHeight: Number(sliderBarHeight.value),
				},
			});
			onConfigChanged?.();
		});
	}
}
