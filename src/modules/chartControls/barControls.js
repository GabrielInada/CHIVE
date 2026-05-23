/**
 * Bar-chart controls module.
 *
 * Builds the right-sidebar control group for the bar chart and wires its
 * listeners. Listeners mutate the active dataset's `configGraficos.bar` via
 * {@link updateActiveDatasetChartConfig} and call back into the host so the
 * chart re-renders.
 *
 * Consumed by the registry in `chartControls/chartControlsManager.js`. The three exports
 * (`createBarChartControls`, `setupBarChartControlListeners`,
 * `computeDefaults`) line up 1:1 with the registry's
 * `{build, attachListeners, computeDefaults}` slots.
 *
 * @typedef {import('../../types.js').Dataset} Dataset
 * @typedef {import('../../types.js').ChartControlContext} ChartControlContext
 */

import { CHART_COLORS } from '../../config/charts.js';
import { t } from '../../services/i18nService.js';
import { updateActiveDatasetChartConfig } from '../state/stateSync.js';
import { createCheckboxControl, createColorInputControl, createSliderControl, createTextControl, normalizeHexColor } from './shared.js';
import { COLOR_PRESETS, createColorPresetControl } from './shared.js';
import { groupControls } from './controlGrouping.js';
import { createSelectControl } from './shared.js';
import {
	setupSelectListeners,
	setupCheckboxListeners,
	setupTextInputListener,
	setupColorInputListener,
	setupSliderListener,
	setupColorPresetListeners,
} from './controlListenerHelpers.js';

/**
 * Build the bar-chart control sections (Data, Display, Styling, Advanced).
 *
 * Reads from `dataset.configGraficos.bar`; the resulting elements expose
 * the standard input ids that {@link setupBarChartControlListeners}
 * later attaches listeners to.
 *
 * @param {Dataset} dataset
 * @param {string[]} categoryOptions - Categorical (or fallback "all") columns for the X-axis select.
 * @param {string[]} [numericOptions=[]] - Numeric columns for the sum/mean value-column select.
 * @param {string[]} [allColumns=[]] - All visible column names (kept for API parity; not used here).
 * @returns {HTMLElement[]} Array of `chart-control-section` elements ready to append to the params pane.
 */
export function createBarChartControls(dataset, categoryOptions, numericOptions = [], allColumns = []) {
	const config = dataset.configGraficos.bar;
	const measureMode = ['count', 'sum', 'mean'].includes(config.measureMode) ? config.measureMode : 'count';
	const valueColumn = numericOptions.includes(config.valueColumn) ? config.valueColumn : null;
	const isDisabled = !dataset.configGraficos.bar.enabled;

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

	stylingControls.push(createColorInputControl(
		'viz-input-bar-color',
		t('chive-chart-control-bar-color'),
		config.color,
		CHART_COLORS.bar,
		isDisabled || config.colorMode !== 'uniform',
	));

	stylingControls.push(createColorInputControl(
		'viz-input-bar-gradient-min',
		t('chive-chart-color-gradient-min'),
		config.gradientMinColor,
		CHART_COLORS.bar,
		isDisabled || config.colorMode === 'uniform',
	));

	stylingControls.push(createColorInputControl(
		'viz-input-bar-gradient-max',
		t('chive-chart-color-gradient-max'),
		config.gradientMaxColor,
		'#ffffff',
		isDisabled || config.colorMode === 'uniform',
	));

	// Gradient distribution sub-toggle (only for auto gradient mode)
	if (config.colorMode === 'gradient') {
		stylingControls.push(createSelectControl(
			'viz-select-bar-gradient-distribution',
			t('chive-chart-color-gradient-distribution'),
			[
				{ value: 'value', label: t('chive-chart-color-gradient-distribution-value') },
				{ value: 'rank', label: t('chive-chart-color-gradient-distribution-rank') },
			],
			config.gradientDistribution || 'value',
			isDisabled
		));
	}

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
		{ id: 'data', title: t('chive-chart-control-bar-category'), controls: dataControls, expanded: true, icon: 'data' },
		{ id: 'display', title: 'Display', controls: displayControls, expanded: true, icon: 'display' },
		{ id: 'styling', title: 'Styling', controls: stylingControls, expanded: false, icon: 'styling' },
		{ id: 'advanced', title: 'Advanced', controls: advancedControls, expanded: false, icon: 'advanced' },
	]);
}

/**
 * Wire listeners for every bar-chart control element produced by
 * {@link createBarChartControls}. Mutates `dataset.configGraficos.bar`
 * via {@link updateActiveDatasetChartConfig} and invokes the
 * `onConfigChanged` callback so the host can re-render.
 *
 * The `allColumnsOrCallback` parameter is overloaded for backward
 * compatibility: callers may pass the callback in either the 4th or 5th slot.
 *
 * @param {Dataset} dataset
 * @param {string[]} baseBar - Categorical (or fallback "all") column names; kept for parity with the listener signature, currently unused.
 * @param {string[]} numericOptions - Numeric column names; used to validate the value-column select.
 * @param {string[] | (() => void)} [allColumnsOrCallback] - Either all-columns array (legacy) or the change callback.
 * @param {() => void} [onConfigChangedMaybe] - Callback when arg 4 is the all-columns array.
 * @returns {void}
 */
export function setupBarChartControlListeners(dataset, baseBar, numericOptions, allColumnsOrCallback = [], onConfigChangedMaybe) {
	const onConfigChanged = typeof allColumnsOrCallback === 'function'
		? allColumnsOrCallback
		: onConfigChangedMaybe;

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
	setupSelectListeners([
		{ id: 'viz-select-bar-gradient-distribution', key: 'gradientDistribution', transform: v =>
			['value', 'rank'].includes(v) ? v : 'value' },
	], dataset, 'bar', onConfigChanged);
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
}

/**
 * Compute the bar chart's activation defaults. Preserves the user's
 * current `category` if it still matches a visible categorical column;
 * otherwise falls back to the first available column (or `null`).
 *
 * @param {Dataset} dataset
 * @param {ChartControlContext} ctx
 * @returns {{ category: string | null }}
 */
export function computeDefaults(dataset, ctx) {
	const current = dataset.configGraficos?.bar?.category;
	const category = ctx.baseCategoricalOrAll.includes(current)
		? current
		: (ctx.baseCategoricalOrAll[0] || null);
	return { category };
}
