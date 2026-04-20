import { CHART_COLORS } from '../../config/charts.js';
import { t } from '../../services/i18nService.js';
import { updateActiveDatasetChartConfig } from '../stateSync.js';
import { createCheckboxControl, createSliderControl, createTextControl, normalizeHexColor } from './shared.js';
import { COLOR_PRESETS, createColorPresetControl } from './shared.js';
import { createChartFilterControls, setupChartFilterControlListeners } from './filterControls.js';
import { groupControls } from './controlGrouping.js';
import { createSelectControl } from './shared.js';
import {
	setupExpandListener,
	setupSelectListeners,
	setupCheckboxListeners,
	setupTextInputListener,
	setupColorInputListener,
	setupSliderListener,
	setupColorPresetListeners,
} from './controlListenerHelpers.js';

export function createBarChartControls(dataset, categoryOptions, numericOptions = [], allColumns = []) {
	const config = dataset.configGraficos.bar;
	const measureMode = ['count', 'sum', 'mean'].includes(config.measureMode) ? config.measureMode : 'count';
	const valueColumn = numericOptions.includes(config.valueColumn) ? config.valueColumn : null;
	const isDisabled = !dataset.configGraficos.bar.enabled;

	// ====== FILTERS SECTION (Top priority, always expanded) ======
	const filterControls = createChartFilterControls({
		chartKey: 'bar',
		rows: dataset.dados,
		allColumns,
		numericColumns: numericOptions,
		rawFilter: config.filter,
		disabled: isDisabled,
	});

	// ====== DATA & AGGREGATION SECTION ======
	const dataControls = [];

	// Category select
	const categoryDiv = createSelectControl(
		'viz-select-bar',
		t('chive-chart-control-bar-category'),
		[
			{ value: '', label: t('chive-chart-option-none') },
			...categoryOptions.map(opt => ({ value: opt, label: opt })),
		],
		config.category,
		isDisabled
	);
	dataControls.push(categoryDiv);

	// Measure mode select
	const measureDiv = createSelectControl(
		'viz-select-bar-measure',
		t('chive-chart-control-bar-measure'),
		[
			{ value: 'count', label: t('chive-chart-control-bar-measure-count') },
			{ value: 'sum', label: t('chive-chart-control-bar-measure-sum') },
			{ value: 'mean', label: t('chive-chart-control-bar-measure-mean') },
		],
		measureMode,
		isDisabled
	);
	dataControls.push(measureDiv);

	// Value column select (for sum/mean)
	const valueColDiv = createSelectControl(
		'viz-select-bar-value-column',
		t('chive-chart-control-bar-value-column'),
		[
			{ value: '', label: t('chive-chart-option-none') },
			...numericOptions.map(opt => ({ value: opt, label: opt })),
		],
		valueColumn,
		isDisabled || measureMode === 'count'
	);
	dataControls.push(valueColDiv);

	// Sort order
	const sortDiv = createSelectControl(
		'viz-select-bar-sort',
		t('chive-chart-control-bar-sort'),
		[
			{ value: 'count-desc', label: t('chive-chart-sort-count-desc') },
			{ value: 'count-asc', label: t('chive-chart-sort-count-asc') },
			{ value: 'label-asc', label: t('chive-chart-sort-label-asc') },
			{ value: 'label-desc', label: t('chive-chart-sort-label-desc') },
		],
		config.sort,
		isDisabled
	);
	dataControls.push(sortDiv);

	// Top N
	const topnDiv = createSelectControl(
		'viz-select-bar-topn',
		t('chive-chart-control-bar-topn'),
		[
			{ value: '0', label: t('chive-chart-topn-all') },
			{ value: '10', label: 'Top 10' },
			{ value: '20', label: 'Top 20' },
			{ value: '50', label: 'Top 50' },
		],
		String(config.topN),
		isDisabled
	);
	dataControls.push(topnDiv);

	// ====== DISPLAY SECTION (Title, height, axis labels) ======
	const displayControls = [];

	displayControls.push(createTextControl(
		'viz-input-bar-title',
		t('chive-chart-control-common-title'),
		config.customTitle,
		80,
		isDisabled
	));

	displayControls.push(createSliderControl(
		'viz-slider-bar-height',
		t('chive-chart-control-common-height'),
		Number(config.chartHeight || 320),
		220,
		720,
		10,
		isDisabled
	));

	displayControls.push(createCheckboxControl(
		'viz-toggle-bar-x-label',
		t('chive-chart-control-axis-label-x'),
		config.showXAxisLabel,
		isDisabled
	));

	displayControls.push(createCheckboxControl(
		'viz-toggle-bar-y-label',
		t('chive-chart-control-axis-label-y'),
		config.showYAxisLabel,
		isDisabled
	));

	// ====== STYLING SECTION (Colors and gradients) ======
	const stylingControls = [];

	stylingControls.push(createSelectControl(
		'viz-select-bar-color-mode',
		t('chive-chart-color-mode'),
		[
			{ value: 'uniform', label: t('chive-chart-color-uniform') },
			{ value: 'gradient', label: t('chive-chart-color-gradient') },
			{ value: 'gradient-manual', label: t('chive-chart-color-gradient-manual') },
		],
		config.colorMode,
		isDisabled
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
	colorInput.disabled = isDisabled || config.colorMode !== 'uniform';
	colorDiv.appendChild(colorLabel);
	colorDiv.appendChild(colorInput);
	stylingControls.push(colorDiv);

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
	minColorInput.disabled = isDisabled || config.colorMode === 'uniform';
	minColorDiv.appendChild(minColorLabel);
	minColorDiv.appendChild(minColorInput);
	stylingControls.push(minColorDiv);

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
	maxColorInput.disabled = isDisabled || config.colorMode === 'uniform';
	maxColorDiv.appendChild(maxColorLabel);
	maxColorDiv.appendChild(maxColorInput);
	stylingControls.push(maxColorDiv);

	// Gradient manual threshold (only for gradient-manual mode)
	if (config.colorMode === 'gradient-manual') {
		stylingControls.push(createSliderControl(
			'viz-slider-bar-threshold',
			t('chive-chart-color-threshold'),
			Number(config.manualThresholdPct || 50),
			0,
			100,
			5,
			isDisabled
		));
	}

	// ====== ADVANCED SECTION (Collapsed by default) ======
	const advancedControls = [];

	advancedControls.push(createColorPresetControl(
		'viz-bar-color-preset',
		t('chive-chart-color-palette'),
		config.colorScheme || 'Bold',
		isDisabled
	));

	// ====== Group and return all sections ======
	return groupControls([
		{ id: 'filter', title: t('chive-chart-filter-column'), controls: filterControls, expanded: true, icon: 'filter' },
		{ id: 'data', title: t('chive-chart-control-bar-category'), controls: dataControls, expanded: true, icon: 'data' },
		{ id: 'display', title: 'Display', controls: displayControls, expanded: true, icon: 'display' },
		{ id: 'styling', title: 'Styling', controls: stylingControls, expanded: false, icon: 'styling' },
		{ id: 'advanced', title: 'Advanced', controls: advancedControls, expanded: false, icon: 'advanced' },
	]);
}

export function setupBarChartControlListeners(dataset, baseBar, numericOptions, allColumnsOrCallback = [], onConfigChangedMaybe) {
	const onConfigChanged = typeof allColumnsOrCallback === 'function'
		? allColumnsOrCallback
		: onConfigChangedMaybe;

	// --- Toggle (custom logic for default category) ---
	const toggleBar = document.getElementById('viz-toggle-bar');
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

	setupExpandListener('viz-expand-bar', dataset, 'bar', onConfigChanged);

	// --- Data controls ---
	setupSelectListeners([
		{ id: 'viz-select-bar', key: 'category' },
		{ id: 'viz-select-bar-sort', key: 'sort' },
		{ id: 'viz-select-bar-topn', key: 'topN', transform: v => Number(v) },
	], dataset, 'bar', onConfigChanged);

	// Measure mode (custom logic for valueColumn dependency)
	const selectBarMeasure = document.getElementById('viz-select-bar-measure');
	if (selectBarMeasure) {
		selectBarMeasure.addEventListener('change', () => {
			const nextMode = ['count', 'sum', 'mean'].includes(selectBarMeasure.value)
				? selectBarMeasure.value
				: 'count';
			const currentValueColumn = numericOptions.includes(dataset.configGraficos.bar?.valueColumn)
				? dataset.configGraficos.bar?.valueColumn
				: null;
			updateActiveDatasetChartConfig({
				bar: {
					...dataset.configGraficos.bar,
					measureMode: nextMode,
					valueColumn: nextMode === 'count' ? null : currentValueColumn,
				},
			});
			onConfigChanged?.();
		});
	}

	// Value column (custom validation against numericOptions)
	const selectBarValueColumn = document.getElementById('viz-select-bar-value-column');
	if (selectBarValueColumn) {
		selectBarValueColumn.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				bar: {
					...dataset.configGraficos.bar,
					valueColumn: numericOptions.includes(selectBarValueColumn.value)
						? selectBarValueColumn.value
						: null,
				},
			});
			onConfigChanged?.();
		});
	}

	// --- Styling controls ---
	setupColorInputListener('viz-input-bar-color', 'color', CHART_COLORS.bar, dataset, 'bar', onConfigChanged);
	setupSelectListeners([
		{ id: 'viz-select-bar-color-mode', key: 'colorMode', transform: v =>
			['uniform', 'gradient', 'gradient-manual'].includes(v) ? v : 'uniform' },
	], dataset, 'bar', onConfigChanged);
	setupColorInputListener('viz-input-bar-gradient-min', 'gradientMinColor', CHART_COLORS.bar, dataset, 'bar', onConfigChanged);
	setupColorInputListener('viz-input-bar-gradient-max', 'gradientMaxColor', '#ffffff', dataset, 'bar', onConfigChanged);
	setupSliderListener('viz-slider-bar-threshold', 'manualThresholdPct', dataset, 'bar', onConfigChanged);
	setupColorPresetListeners('viz-bar-color-preset', {
		color: 0, gradientMinColor: 0, gradientMaxColor: -1,
	}, { color: CHART_COLORS.bar, gradientMinColor: CHART_COLORS.bar, gradientMaxColor: '#ffffff' },
	dataset, 'bar', onConfigChanged, COLOR_PRESETS);

	// --- Display controls ---
	setupCheckboxListeners([
		{ id: 'viz-toggle-bar-x-label', key: 'showXAxisLabel' },
		{ id: 'viz-toggle-bar-y-label', key: 'showYAxisLabel' },
	], dataset, 'bar', onConfigChanged);
	setupTextInputListener('viz-input-bar-title', 'customTitle', dataset, 'bar', onConfigChanged);
	setupSliderListener('viz-slider-bar-height', 'chartHeight', dataset, 'bar', onConfigChanged);

	// --- Filter controls ---
	setupChartFilterControlListeners({
		chartKey: 'bar',
		rows: dataset.dados,
		numericColumns: numericOptions,
		rawFilter: dataset.configGraficos.bar?.filter,
		onFilterChange: nextFilter => {
			updateActiveDatasetChartConfig({
				bar: {
					...dataset.configGraficos.bar,
					filter: nextFilter,
				},
			});
			onConfigChanged?.();
		},
	});
}
