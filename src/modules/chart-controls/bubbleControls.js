import { BUBBLE_CHART } from '../../config/charts.js';
import { t } from '../../services/i18nService.js';
import { updateActiveDatasetChartConfig } from '../stateSync.js';
import { createTextControl, createSliderControl, createSelectControl, createColorPresetControl, COLOR_PRESETS } from './shared.js';
import { groupControls } from './controlGrouping.js';
import {
	setupExpandListener,
	setupSelectListeners,
	setupSliderListener,
	setupTextInputListener,
	setupColorPresetListeners,
} from './controlListenerHelpers.js';

/**
 * Resolve effective nestingColumns from config, with groupColumn migration.
 */
function resolveNestingColumnsFromConfig(config) {
	if (Array.isArray(config.nestingColumns) && config.nestingColumns.length > 0) {
		return [...config.nestingColumns];
	}
	if (config.groupColumn && typeof config.groupColumn === 'string') {
		return [config.groupColumn];
	}
	return [];
}

/**
 * Build progressive nesting level selectors.
 * Level N+1 only appears if level N has a selected value.
 */
function createNestingControls(config, categoryColumn, allColumns, disabled) {
	const nestingColumns = resolveNestingColumnsFromConfig(config);
	const nestingMode = BUBBLE_CHART.nestingModes.includes(config.nestingMode)
		? config.nestingMode
		: BUBBLE_CHART.defaultNestingMode;

	const controls = [];
	const isGrouped = nestingMode === 'grouped';
	const nestingDisabled = disabled || !isGrouped;

	// Determine how many selectors to show: existing levels + 1 empty (if all filled)
	const levelCount = isGrouped
		? Math.max(BUBBLE_CHART.maxInitialNestingControlsVisible, nestingColumns.length + (nestingColumns.length > 0 ? 1 : 0))
		: BUBBLE_CHART.maxInitialNestingControlsVisible;

	for (let i = 0; i < levelCount; i++) {
		// Exclude already-selected columns at other levels and the category column
		const excludedColumns = new Set(
			nestingColumns.filter((_, idx) => idx !== i)
		);
		if (categoryColumn) excludedColumns.add(categoryColumn);

		const availableColumns = allColumns.filter(col => !excludedColumns.has(col));
		const options = [
			{ value: '', label: t('chive-chart-control-bubble-nesting-empty') },
			...availableColumns.map(opt => ({ value: opt, label: opt })),
		];

		const currentValue = nestingColumns[i] || '';
		controls.push(createSelectControl(
			`viz-select-bubble-nesting-level-${i}`,
			t('chive-chart-control-bubble-nesting-level', i + 1),
			options,
			currentValue,
			nestingDisabled
		));

		// If this level is empty, don't show more levels
		if (!currentValue) break;
	}

	return controls;
}

export function createBubbleChartControls(dataset, categoryOptions, numericOptions = [], allColumns = []) {
	const config = dataset.configGraficos.bubble;
	const disabled = !dataset.configGraficos.bubble.enabled;
	const measureMode = BUBBLE_CHART.measureModes.includes(config.measureMode)
		? config.measureMode
		: BUBBLE_CHART.defaultMeasureMode;
	const nestingMode = BUBBLE_CHART.nestingModes.includes(config.nestingMode)
		? config.nestingMode
		: BUBBLE_CHART.defaultNestingMode;

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

	// Progressive nesting level selectors
	const nestingControls = createNestingControls(config, config.category, allColumns, disabled);
	dataControls.push(...nestingControls);

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
		{ id: 'data', title: t('chive-chart-control-bubble-category'), controls: dataControls, expanded: true, icon: 'data' },
		{ id: 'display', title: 'Display', controls: displayControls, expanded: true, icon: 'display' },
		{ id: 'styling', title: 'Styling', controls: stylingControls, expanded: false, icon: 'styling' },
	]);
}

export function setupBubbleChartControlListeners(dataset, baseBubble, numericOptions, allColumnsOrCallback = [], onConfigChangedMaybe) {
	const allColumns = typeof allColumnsOrCallback === 'function' ? [] : allColumnsOrCallback;
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
		{ id: 'viz-select-bubble-topn', key: 'topN', transform: v => Number(v) },
		{ id: 'viz-select-bubble-label-mode', key: 'labelMode', transform: v => (['all', 'hover', 'auto'].includes(v) ? v : 'auto') },
	], dataset, 'bubble', onConfigChanged);

	// Progressive nesting level listeners
	const nestingColumns = resolveNestingColumnsFromConfig(dataset.configGraficos.bubble);
	const maxLevels = nestingColumns.length + 1;
	for (let i = 0; i < maxLevels; i++) {
		const selectEl = document.getElementById(`viz-select-bubble-nesting-level-${i}`);
		if (!selectEl) continue;
		const levelIndex = i;
		selectEl.addEventListener('change', () => {
			const currentNesting = resolveNestingColumnsFromConfig(dataset.configGraficos.bubble);
			const newValue = selectEl.value || null;
			if (newValue) {
				// Set this level and truncate deeper levels
				const updated = currentNesting.slice(0, levelIndex);
				updated[levelIndex] = newValue;
				updateActiveDatasetChartConfig({
					bubble: {
						...dataset.configGraficos.bubble,
						nestingColumns: updated,
						groupColumn: updated[0] || null,
					},
				});
			} else {
				// Clearing this level: truncate from this level onward
				const updated = currentNesting.slice(0, levelIndex);
				updateActiveDatasetChartConfig({
					bubble: {
						...dataset.configGraficos.bubble,
						nestingColumns: updated,
						groupColumn: updated[0] || null,
					},
				});
			}
			onConfigChanged?.();
		});
	}

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
}
