/**
 * Bubble-chart controls module.
 *
 * Builds the right-sidebar control group for the bubble chart and wires
 * listeners. Notable: the bubble chart supports *progressive nesting* — a
 * variable-depth column hierarchy ({@link createNestingControls}) that
 * appends one new select per filled level.
 *
 * Legacy `groupColumn` is migrated to the canonical `nestingColumns` array
 * on read via {@link resolveNestingColumnsFromConfig}.
 *
 * @typedef {import('../../types.js').Dataset} Dataset
 * @typedef {import('../../types.js').ChartControlContext} ChartControlContext
 */

import { BUBBLE_CHART } from '../../config/charts.js';
import { t } from '../../services/i18nService.js';
import { updateActiveDatasetChartConfig } from '../state/stateSync.js';
import { createTextControl, createSliderControl, createSelectControl, createColorPresetControl, COLOR_PRESETS } from './shared.js';
import { groupControls } from './controlGrouping.js';
import {
	setupSelectListeners,
	setupSliderListener,
	setupTextInputListener,
	setupColorPresetListeners,
} from './controlListenerHelpers.js';

/**
 * Resolve the effective nesting-column list for a bubble config. Reads
 * `nestingColumns` when present; otherwise falls back to legacy
 * `groupColumn` so old persisted configs still work.
 *
 * @private
 * @param {Object} config - The bubble chart config block.
 * @returns {string[]}
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
 * Build progressive nesting-level selectors. Each filled level appends a
 * fresh empty selector below it (up to the configured max). Selecting an
 * empty value truncates all deeper levels.
 *
 * @private
 * @param {Object} config
 * @param {string | null} categoryColumn - Currently selected category column (excluded from nesting options).
 * @param {string[]} allColumns - All visible column names.
 * @param {boolean} disabled - Forces every select disabled when true.
 * @returns {HTMLElement[]}
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

/**
 * Build the bubble-chart control sections (Data + nesting, Display, Styling).
 *
 * @param {Dataset} dataset
 * @param {string[]} categoryOptions - Categorical (or fallback "all") column names for the root category select.
 * @param {string[]} [numericOptions=[]] - Numeric column names for the sum/mean value-column select.
 * @param {string[]} [allColumns=[]] - All visible column names; used to populate the progressive nesting selects.
 * @returns {HTMLElement[]} Array of `chart-control-section` elements.
 */
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

/**
 * Wire listeners for every bubble-chart control. Handles the progressive
 * nesting selects (level N+1 appears only after level N is filled) and the
 * `measureMode` ↔ `valueColumn` cross-constraint.
 *
 * The `allColumnsOrCallback` parameter is overloaded for backward
 * compatibility: callers may pass the callback in the 4th or 5th slot.
 *
 * @param {Dataset} dataset
 * @param {string[]} baseBubble - Categorical (or fallback "all") column names; kept for parity.
 * @param {string[]} numericOptions - Numeric column names; used to validate the value-column select.
 * @param {string[] | (() => void)} [allColumnsOrCallback]
 * @param {() => void} [onConfigChangedMaybe]
 * @returns {void}
 */
export function setupBubbleChartControlListeners(dataset, baseBubble, numericOptions, allColumnsOrCallback = [], onConfigChangedMaybe) {
	const allColumns = typeof allColumnsOrCallback === 'function' ? [] : allColumnsOrCallback;
	const onConfigChanged = typeof allColumnsOrCallback === 'function'
		? allColumnsOrCallback
		: onConfigChangedMaybe;

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

/**
 * Compute the bubble chart's activation defaults. Preserves the user's
 * current `category` and `valueColumn` when they still match visible
 * columns; otherwise falls back to the first available column. In
 * `measureMode === 'count'` the `valueColumn` is left untouched.
 *
 * @param {Dataset} dataset
 * @param {ChartControlContext} ctx
 * @returns {{ category: string | null, valueColumn: string | null }}
 */
export function computeDefaults(dataset, ctx) {
	const currentCat = dataset.configGraficos?.bubble?.category;
	const currentVal = dataset.configGraficos?.bubble?.valueColumn;
	const measureMode = dataset.configGraficos?.bubble?.measureMode;
	const valueColumn = measureMode !== 'count'
		? (ctx.numericas.includes(currentVal) ? currentVal : (ctx.numericas[0] || null))
		: currentVal;
	return {
		category: ctx.baseCategoricalOrAll.includes(currentCat)
			? currentCat
			: (ctx.baseCategoricalOrAll[0] || null),
		valueColumn,
	};
}
