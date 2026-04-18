import { BUBBLE_CHART } from '../../config/charts.js';
import { t } from '../../services/i18nService.js';
import { updateActiveDatasetChartConfig } from '../stateSync.js';
import { createTextControl, createSliderControl, createSelectControl, createColorPresetControl, COLOR_PRESETS } from './shared.js';
import { createChartFilterControls, setupChartFilterControlListeners } from './filterControls.js';
import { groupControls } from './controlGrouping.js';
import {
	setupExpandListener,
	setupSelectListeners,
	setupSliderListener,
	setupTextInputListener,
	setupColorPresetListeners,
} from './controlListenerHelpers.js';

export function createBubbleChartControls(dataset, categoryOptions, numericOptions = [], allColumns = []) {
	const config = dataset.configGraficos.bubble;
	const disabled = !dataset.configGraficos.bubble.enabled;
	const measureMode = BUBBLE_CHART.measureModes.includes(config.measureMode)
		? config.measureMode
		: BUBBLE_CHART.defaultMeasureMode;
	const nestingMode = BUBBLE_CHART.nestingModes.includes(config.nestingMode)
		? config.nestingMode
		: BUBBLE_CHART.defaultNestingMode;
	const groupOptions = [
		{ value: '', label: t('chive-chart-option-none') },
		...allColumns.map(opt => ({ value: opt, label: opt })),
	];

	const filterControls = createChartFilterControls({
		chartKey: 'bubble',
		rows: dataset.dados,
		allColumns,
		numericColumns: numericOptions,
		rawFilter: config.filter,
		disabled,
	});

	const dataControls = [];
	dataControls.push(createSelectControl(
		'viz-select-bubble-category',
		t('chive-chart-control-bubble-category'),
		[
			{ value: '', label: t('chive-chart-option-none') },
			...categoryOptions.map(opt => ({ value: opt, label: opt })),
		],
		config.category,
		disabled
	));

	dataControls.push(createSelectControl(
		'viz-select-bubble-nesting-mode',
		t('chive-chart-control-bubble-nesting-mode'),
		[
			{ value: 'flat', label: t('chive-chart-control-bubble-nesting-flat') },
			{ value: 'grouped', label: t('chive-chart-control-bubble-nesting-grouped') },
		],
		nestingMode,
		disabled
	));

	dataControls.push(createSelectControl(
		'viz-select-bubble-measure',
		t('chive-chart-control-bubble-measure'),
		[
			{ value: 'count', label: t('chive-chart-control-bubble-measure-count') },
			{ value: 'sum', label: t('chive-chart-control-bubble-measure-sum') },
			{ value: 'mean', label: t('chive-chart-control-bubble-measure-mean') },
		],
		measureMode,
		disabled
	));

	dataControls.push(createSelectControl(
		'viz-select-bubble-value-column',
		t('chive-chart-control-bubble-value-column'),
		[
			{ value: '', label: t('chive-chart-option-none') },
			...numericOptions.map(opt => ({ value: opt, label: opt })),
		],
		config.valueColumn,
		disabled || measureMode === 'count'
	));

	const groupLabel = nestingMode === 'grouped'
		? t('chive-chart-control-bubble-group-parent')
		: t('chive-chart-control-bubble-group-color');
	dataControls.push(createSelectControl(
		'viz-select-bubble-group-column',
		groupLabel,
		groupOptions,
		config.groupColumn,
		disabled
	));

	dataControls.push(createSelectControl(
		'viz-select-bubble-topn',
		t('chive-chart-control-bubble-topn'),
		BUBBLE_CHART.topNOptions.map(option => ({
			value: String(option),
			label: option === 0 ? t('chive-chart-topn-all') : `Top ${option}`,
		})),
		String(config.topN),
		disabled
	));

	const displayControls = [];
	displayControls.push(createTextControl(
		'viz-input-bubble-title',
		t('chive-chart-control-common-title'),
		config.customTitle,
		80,
		disabled
	));

	displayControls.push(createSliderControl(
		'viz-slider-bubble-height',
		t('chive-chart-control-common-height'),
		Number(config.chartHeight || 700),
		400,
		900,
		10,
		disabled
	));

	displayControls.push(createSelectControl(
		'viz-select-bubble-label-mode',
		t('chive-chart-control-bubble-label-mode'),
		[
			{ value: 'all', label: t('chive-chart-control-bubble-label-mode-all') },
			{ value: 'hover', label: t('chive-chart-control-bubble-label-mode-hover') },
			{ value: 'auto', label: t('chive-chart-control-bubble-label-mode-auto') },
		],
		config.labelMode,
		disabled
	));

	const stylingControls = [];
	stylingControls.push(createSliderControl(
		'viz-slider-bubble-padding',
		t('chive-chart-control-bubble-padding'),
		Number(config.padding ?? BUBBLE_CHART.defaultPadding),
		1,
		10,
		1,
		disabled
	));
	stylingControls.push(createColorPresetControl(
		'viz-bubble-color-preset',
		t('chive-chart-color-palette'),
		config.colorScheme || 'Tableau10',
		disabled
	));

	return groupControls([
		{ id: 'filter', title: t('chive-chart-filter-column'), controls: filterControls, expanded: true, icon: 'filter' },
		{ id: 'data', title: t('chive-chart-control-bubble-category'), controls: dataControls, expanded: true, icon: 'data' },
		{ id: 'display', title: 'Display', controls: displayControls, expanded: true, icon: 'display' },
		{ id: 'styling', title: 'Styling', controls: stylingControls, expanded: false, icon: 'styling' },
	]);
}

export function setupBubbleChartControlListeners(dataset, baseBubble, numericOptions, allColumnsOrCallback = [], onConfigChangedMaybe) {
	const onConfigChanged = typeof allColumnsOrCallback === 'function'
		? allColumnsOrCallback
		: onConfigChangedMaybe;

	const toggleBubble = document.getElementById('viz-toggle-bubble');
	if (toggleBubble) {
		toggleBubble.addEventListener('change', () => {
			const categoriaAtual = dataset.configGraficos.bubble?.category;
			const categoriaPadrao = baseBubble.includes(categoriaAtual)
				? categoriaAtual
				: (baseBubble[0] || null);
			const currentValueColumn = numericOptions.includes(dataset.configGraficos.bubble?.valueColumn)
				? dataset.configGraficos.bubble?.valueColumn
				: null;
			updateActiveDatasetChartConfig({
				bubble: {
					...dataset.configGraficos.bubble,
					enabled: toggleBubble.checked,
					category: toggleBubble.checked ? categoriaPadrao : categoriaAtual,
					valueColumn: toggleBubble.checked && dataset.configGraficos.bubble?.measureMode !== 'count'
						? (currentValueColumn || numericOptions[0] || null)
						: dataset.configGraficos.bubble?.valueColumn,
					expanded: toggleBubble.checked ? true : dataset.configGraficos.bubble?.expanded === true,
				},
			});
			onConfigChanged?.();
		});
	}

	setupExpandListener('viz-expand-bubble', dataset, 'bubble', onConfigChanged);

	setupSelectListeners([
		{ id: 'viz-select-bubble-category', key: 'category' },
		{ id: 'viz-select-bubble-nesting-mode', key: 'nestingMode', transform: v => (BUBBLE_CHART.nestingModes.includes(v) ? v : BUBBLE_CHART.defaultNestingMode) },
		{ id: 'viz-select-bubble-group-column', key: 'groupColumn', transform: v => v || null },
		{ id: 'viz-select-bubble-topn', key: 'topN', transform: v => Number(v) },
		{ id: 'viz-select-bubble-label-mode', key: 'labelMode', transform: v => (['all', 'hover', 'auto'].includes(v) ? v : 'auto') },
	], dataset, 'bubble', onConfigChanged);

	const measureSelect = document.getElementById('viz-select-bubble-measure');
	if (measureSelect) {
		measureSelect.addEventListener('change', () => {
			const nextMode = BUBBLE_CHART.measureModes.includes(measureSelect.value)
				? measureSelect.value
				: BUBBLE_CHART.defaultMeasureMode;
			const currentValueColumn = numericOptions.includes(dataset.configGraficos.bubble?.valueColumn)
				? dataset.configGraficos.bubble?.valueColumn
				: null;
			updateActiveDatasetChartConfig({
				bubble: {
					...dataset.configGraficos.bubble,
					measureMode: nextMode,
					valueColumn: nextMode === 'count' ? null : (currentValueColumn || numericOptions[0] || null),
				},
			});
			onConfigChanged?.();
		});
	}

	const valueSelect = document.getElementById('viz-select-bubble-value-column');
	if (valueSelect) {
		valueSelect.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				bubble: {
					...dataset.configGraficos.bubble,
					valueColumn: numericOptions.includes(valueSelect.value) ? valueSelect.value : null,
				},
			});
			onConfigChanged?.();
		});
	}

	setupSliderListener('viz-slider-bubble-height', 'chartHeight', dataset, 'bubble', onConfigChanged);
	setupSliderListener('viz-slider-bubble-padding', 'padding', dataset, 'bubble', onConfigChanged);
	setupTextInputListener('viz-input-bubble-title', 'customTitle', dataset, 'bubble', onConfigChanged);
	setupColorPresetListeners('viz-bubble-color-preset', {}, {}, dataset, 'bubble', onConfigChanged, COLOR_PRESETS);

	setupChartFilterControlListeners({
		chartKey: 'bubble',
		rows: dataset.dados,
		numericColumns: numericOptions,
		rawFilter: dataset.configGraficos.bubble?.filter,
		onFilterChange: nextFilter => {
			updateActiveDatasetChartConfig({
				bubble: {
					...dataset.configGraficos.bubble,
					filter: nextFilter,
				},
			});
			onConfigChanged?.();
		},
	});
}