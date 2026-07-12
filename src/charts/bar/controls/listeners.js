/**
 * Bar-chart controls: listener wiring.
 *
 * Attaches listeners to the control elements produced by the builder. Each
 * listener mutates the active dataset's `chartConfig.bar` through the shared
 * chart-control config adapter and calls back into the host so the chart
 * re-renders.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 */

import { CHART_COLORS } from '../../../config/charts.js';
import { COLOR_PRESETS } from '../../shared/controls/factories.js';
import {
	commitChartConfigPatch,
	setupSelectListeners,
	setupCheckboxListeners,
	setupTextInputListener,
	setupColorInputListener,
	setupSliderListener,
	setupColorPresetListeners,
} from '../../../modules/chartControls/controlListenerHelpers.js';

/**
 * Wire listeners for every bar-chart control element produced by
 * `createBarChartControls`. Mutates `dataset.chartConfig.bar`
 * through the shared config-write adapter and invokes the
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
			const currentValueColumn = numericOptions.includes(dataset.chartConfig.bar?.valueColumn)
				? dataset.chartConfig.bar?.valueColumn
				: null;
			commitChartConfigPatch(dataset, 'bar', {
				measureMode: nextMode,
				valueColumn: nextMode === 'count' ? null : currentValueColumn,
			}, onConfigChanged);
		});
	}

	// Value column (custom validation against numericOptions)
	const selectBarValueColumn = document.getElementById('viz-select-bar-value-column');
	if (selectBarValueColumn) {
		selectBarValueColumn.addEventListener('change', () => {
			commitChartConfigPatch(dataset, 'bar', {
				valueColumn: numericOptions.includes(selectBarValueColumn.value)
					? selectBarValueColumn.value
					: null,
			}, onConfigChanged);
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
}
