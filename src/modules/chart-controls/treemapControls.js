import { CHART_COLORS, TREEMAP_CHART } from '../../config/charts.js';
import { t } from '../../services/i18nService.js';
import { updateActiveDatasetChartConfig } from '../stateSync.js';
import { createCheckboxControl, createSliderControl, createTextControl, normalizeHexColor } from './shared.js';
import { COLOR_PRESETS, createColorPresetControl } from './shared.js';
import { groupControls } from './controlGrouping.js';
import { createSelectControl } from './shared.js';
import { setupExpandListener } from './controlListenerHelpers.js';

export function createTreeMapControls(dataset, categoryOptions, numericOptions = [], allColumns = []) {
	const config = dataset.configGraficos.treemap;
	const measureMode = TREEMAP_CHART.measureModes.includes(config.measureMode) ? config.measureMode : 'count';
	const valueColumn = numericOptions.includes(config.valueColumn) ? config.valueColumn : null;
	const isDisabled = !config.enabled;

	// ====== DATA SECTION ======
	const dataControls = [];

	dataControls.push(createSelectControl(
		'viz-select-treemap-category',
		t('chive-chart-control-treemap-category'),
		[
			{ value: '', label: t('chive-chart-option-none') },
			...categoryOptions.map(opt => ({ value: opt, label: opt })),
		],
		config.category,
		isDisabled
	));

	dataControls.push(createSelectControl(
		'viz-select-treemap-measure',
		t('chive-chart-control-treemap-measure'),
		[
			{ value: 'count', label: t('chive-chart-control-bar-measure-count') },
			{ value: 'sum', label: t('chive-chart-control-bar-measure-sum') },
		],
		measureMode,
		isDisabled
	));

	dataControls.push(createSelectControl(
		'viz-select-treemap-value-column',
		t('chive-chart-control-treemap-value-column'),
		[
			{ value: '', label: t('chive-chart-option-none') },
			...numericOptions.map(opt => ({ value: opt, label: opt })),
		],
		valueColumn,
		isDisabled || measureMode === 'count'
	));

	dataControls.push(createSelectControl(
		'viz-select-treemap-topn',
		t('chive-chart-control-bar-topn'),
		[
			{ value: '0', label: t('chive-chart-topn-all') },
			{ value: '10', label: 'Top 10' },
			{ value: '20', label: 'Top 20' },
			{ value: '50', label: 'Top 50' },
		],
		String(config.topN),
		isDisabled
	));

	// ====== DISPLAY SECTION ======
	const displayControls = [];

	displayControls.push(createTextControl(
		'viz-input-treemap-title',
		t('chive-chart-control-common-title'),
		config.customTitle,
		80,
		isDisabled
	));

	displayControls.push(createSliderControl(
		'viz-slider-treemap-height',
		t('chive-chart-control-common-height'),
		Number(config.chartHeight || 380),
		220,
		720,
		10,
		isDisabled
	));

	displayControls.push(createSliderControl(
		'viz-slider-treemap-padding',
		t('chive-chart-control-treemap-padding'),
		Number(config.padding || 2),
		1,
		6,
		1,
		isDisabled
	));

	displayControls.push(createCheckboxControl(
		'viz-toggle-treemap-labels',
		t('chive-chart-control-treemap-show-labels'),
		config.showLabels,
		isDisabled
	));

	displayControls.push(createCheckboxControl(
		'viz-toggle-treemap-values',
		t('chive-chart-control-treemap-show-values'),
		config.showValues,
		isDisabled
	));

	// ====== STYLING SECTION ======
	const stylingControls = [];

	stylingControls.push(createSelectControl(
		'viz-select-treemap-color-mode',
		t('chive-chart-color-mode'),
		[
			{ value: 'scheme', label: t('chive-chart-color-scheme') },
			{ value: 'uniform', label: t('chive-chart-color-uniform') },
		],
		config.colorMode || 'scheme',
		isDisabled
	));

	const colorDiv = document.createElement('div');
	colorDiv.className = 'chart-controle';
	const colorLabel = document.createElement('label');
	colorLabel.htmlFor = 'viz-input-treemap-color';
	colorLabel.textContent = t('chive-chart-control-bar-color');
	const colorInput = document.createElement('input');
	colorInput.id = 'viz-input-treemap-color';
	colorInput.type = 'color';
	colorInput.className = 'chart-color-input';
	colorInput.value = normalizeHexColor(config.color, CHART_COLORS.treemap);
	colorInput.disabled = isDisabled || config.colorMode !== 'uniform';
	colorDiv.appendChild(colorLabel);
	colorDiv.appendChild(colorInput);
	stylingControls.push(colorDiv);

	// ====== ADVANCED SECTION ======
	const advancedControls = [];

	advancedControls.push(createColorPresetControl(
		'viz-treemap-color-preset',
		t('chive-chart-color-palette'),
		config.colorScheme || 'Bold',
		isDisabled
	));

	return groupControls([
		{ id: 'data', title: t('chive-chart-control-treemap-category'), controls: dataControls, expanded: true, icon: 'data' },
		{ id: 'display', title: 'Display', controls: displayControls, expanded: true, icon: 'display' },
		{ id: 'styling', title: 'Styling', controls: stylingControls, expanded: false, icon: 'styling' },
		{ id: 'advanced', title: 'Advanced', controls: advancedControls, expanded: false, icon: 'advanced' },
	]);
}

export function setupTreeMapControlListeners(dataset, baseCat, numericOptions, allColumnsOrCallback = [], onConfigChangedMaybe) {
	const onConfigChanged = typeof allColumnsOrCallback === 'function'
		? allColumnsOrCallback
		: onConfigChangedMaybe;

	const toggleTreemap = document.getElementById('viz-toggle-treemap');
	if (toggleTreemap) {
		toggleTreemap.addEventListener('change', () => {
			const categoriaAtual = dataset.configGraficos.treemap?.category;
			const categoriaPadrao = baseCat.includes(categoriaAtual) ? categoriaAtual : (baseCat[0] || null);
			updateActiveDatasetChartConfig({
				treemap: {
					...dataset.configGraficos.treemap,
					enabled: toggleTreemap.checked,
					category: toggleTreemap.checked ? categoriaPadrao : categoriaAtual,
					expanded: toggleTreemap.checked ? true : dataset.configGraficos.treemap?.expanded === true,
				},
			});
			onConfigChanged?.();
		});
	}

	setupExpandListener('viz-expand-treemap', dataset, 'treemap', onConfigChanged);

	const selectCategory = document.getElementById('viz-select-treemap-category');
	if (selectCategory) {
		selectCategory.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				treemap: { ...dataset.configGraficos.treemap, category: selectCategory.value || null },
			});
			onConfigChanged?.();
		});
	}

	const selectMeasure = document.getElementById('viz-select-treemap-measure');
	if (selectMeasure) {
		selectMeasure.addEventListener('change', () => {
			const nextMode = TREEMAP_CHART.measureModes.includes(selectMeasure.value) ? selectMeasure.value : 'count';
			const currentValueColumn = numericOptions.includes(dataset.configGraficos.treemap?.valueColumn)
				? dataset.configGraficos.treemap?.valueColumn
				: null;
			updateActiveDatasetChartConfig({
				treemap: {
					...dataset.configGraficos.treemap,
					measureMode: nextMode,
					valueColumn: nextMode === 'count' ? null : currentValueColumn,
				},
			});
			onConfigChanged?.();
		});
	}

	const selectValueColumn = document.getElementById('viz-select-treemap-value-column');
	if (selectValueColumn) {
		selectValueColumn.addEventListener('change', () => {
			const nextValue = numericOptions.includes(selectValueColumn.value) ? selectValueColumn.value : null;
			updateActiveDatasetChartConfig({
				treemap: { ...dataset.configGraficos.treemap, valueColumn: nextValue },
			});
			onConfigChanged?.();
		});
	}

	const selectTopN = document.getElementById('viz-select-treemap-topn');
	if (selectTopN) {
		selectTopN.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				treemap: { ...dataset.configGraficos.treemap, topN: Number(selectTopN.value) },
			});
			onConfigChanged?.();
		});
	}

	const inputTitle = document.getElementById('viz-input-treemap-title');
	if (inputTitle) {
		inputTitle.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				treemap: { ...dataset.configGraficos.treemap, customTitle: String(inputTitle.value || '').trim() },
			});
			onConfigChanged?.();
		});
	}

	const sliderHeight = document.getElementById('viz-slider-treemap-height');
	if (sliderHeight) {
		const syncOutput = () => {
			const output = sliderHeight.parentElement?.querySelector('output');
			if (output) output.textContent = sliderHeight.value;
		};
		sliderHeight.addEventListener('input', syncOutput);
		sliderHeight.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				treemap: { ...dataset.configGraficos.treemap, chartHeight: Number(sliderHeight.value) },
			});
			onConfigChanged?.();
		});
	}

	const sliderPadding = document.getElementById('viz-slider-treemap-padding');
	if (sliderPadding) {
		const syncOutput = () => {
			const output = sliderPadding.parentElement?.querySelector('output');
			if (output) output.textContent = sliderPadding.value;
		};
		sliderPadding.addEventListener('input', syncOutput);
		sliderPadding.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				treemap: { ...dataset.configGraficos.treemap, padding: Number(sliderPadding.value) },
			});
			onConfigChanged?.();
		});
	}

	const toggleLabels = document.getElementById('viz-toggle-treemap-labels');
	if (toggleLabels) {
		toggleLabels.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				treemap: { ...dataset.configGraficos.treemap, showLabels: toggleLabels.checked },
			});
			onConfigChanged?.();
		});
	}

	const toggleValues = document.getElementById('viz-toggle-treemap-values');
	if (toggleValues) {
		toggleValues.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				treemap: { ...dataset.configGraficos.treemap, showValues: toggleValues.checked },
			});
			onConfigChanged?.();
		});
	}

	const selectColorMode = document.getElementById('viz-select-treemap-color-mode');
	if (selectColorMode) {
		selectColorMode.addEventListener('change', () => {
			const nextMode = ['scheme', 'uniform'].includes(selectColorMode.value) ? selectColorMode.value : 'scheme';
			updateActiveDatasetChartConfig({
				treemap: { ...dataset.configGraficos.treemap, colorMode: nextMode },
			});
			onConfigChanged?.();
		});
	}

	const inputColor = document.getElementById('viz-input-treemap-color');
	if (inputColor) {
		inputColor.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				treemap: {
					...dataset.configGraficos.treemap,
					color: normalizeHexColor(inputColor.value, CHART_COLORS.treemap),
				},
			});
			onConfigChanged?.();
		});
	}

	const presetButtons = document.querySelectorAll('button[data-color-preset-control="viz-treemap-color-preset"]');
	presetButtons.forEach(button => {
		button.addEventListener('click', () => {
			const presetName = button.dataset.presetName;
			const palette = COLOR_PRESETS[presetName] || [];
			if (palette.length === 0) return;
			updateActiveDatasetChartConfig({
				treemap: {
					...dataset.configGraficos.treemap,
					colorScheme: presetName,
					color: normalizeHexColor(palette[0], CHART_COLORS.treemap),
				},
			});
			onConfigChanged?.();
		});
	});
}

