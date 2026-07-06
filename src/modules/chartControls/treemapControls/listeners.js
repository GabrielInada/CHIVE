/**
 * Treemap controls: listener wiring.
 *
 * Wires every treemap control. Handles the `measureMode` ↔ `valueColumn`
 * cross-constraint and the color-preset → primary-color mapping.
 *
 * Note: this module wires listeners by hand (per-element `addEventListener`)
 * rather than via the `setupSelectListeners`/etc. helpers used by other
 * modules, same effect, more verbose. The color input is the exception:
 * it goes through `setupColorInputListener` so the chart live-updates
 * while the picker is open, like every other chart's color input.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 */

import { CHART_COLORS, TREEMAP_CHART } from '../../../config/charts.js';
import { updateActiveDatasetConfig } from '../../state/appState.js';
import { setupColorInputListener } from '../controlListenerHelpers.js';
import { COLOR_PRESETS, normalizeHexColor } from '../shared.js';

/**
 * Wire listeners for every treemap control. Handles the `measureMode` ↔
 * `valueColumn` cross-constraint and color-preset → primary-color mapping.
 *
 * The `allColumnsOrCallback` parameter is overloaded for backward
 * compatibility (callback in arg 4 or arg 5).
 *
 * @param {Dataset} dataset
 * @param {string[]} baseCat - Categorical (or fallback "all") column names; kept for parity.
 * @param {string[]} numericOptions
 * @param {string[] | (() => void)} [allColumnsOrCallback]
 * @param {() => void} [onConfigChangedMaybe]
 * @returns {void}
 */
export function setupTreeMapControlListeners(dataset, baseCat, numericOptions, allColumnsOrCallback = [], onConfigChangedMaybe) {
	const onConfigChanged = typeof allColumnsOrCallback === 'function'
		? allColumnsOrCallback
		: onConfigChangedMaybe;

	const selectCategory = document.getElementById('viz-select-treemap-category');
	if (selectCategory) {
		selectCategory.addEventListener('change', () => {
			updateActiveDatasetConfig({
				treemap: { ...dataset.chartConfig.treemap, category: selectCategory.value || null },
			});
			onConfigChanged?.();
		});
	}

	const selectMeasure = document.getElementById('viz-select-treemap-measure');
	if (selectMeasure) {
		selectMeasure.addEventListener('change', () => {
			const nextMode = TREEMAP_CHART.measureModes.includes(selectMeasure.value) ? selectMeasure.value : 'count';
			const currentValueColumn = numericOptions.includes(dataset.chartConfig.treemap?.valueColumn)
				? dataset.chartConfig.treemap?.valueColumn
				: null;
			updateActiveDatasetConfig({
				treemap: {
					...dataset.chartConfig.treemap,
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
			updateActiveDatasetConfig({
				treemap: { ...dataset.chartConfig.treemap, valueColumn: nextValue },
			});
			onConfigChanged?.();
		});
	}

	const selectTopN = document.getElementById('viz-select-treemap-topn');
	if (selectTopN) {
		selectTopN.addEventListener('change', () => {
			updateActiveDatasetConfig({
				treemap: { ...dataset.chartConfig.treemap, topN: Number(selectTopN.value) },
			});
			onConfigChanged?.();
		});
	}

	const inputTitle = document.getElementById('viz-input-treemap-title');
	if (inputTitle) {
		inputTitle.addEventListener('change', () => {
			updateActiveDatasetConfig({
				treemap: { ...dataset.chartConfig.treemap, customTitle: String(inputTitle.value || '').trim() },
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
			updateActiveDatasetConfig({
				treemap: { ...dataset.chartConfig.treemap, padding: Number(sliderPadding.value) },
			});
			onConfigChanged?.();
		});
	}

	const toggleLabels = document.getElementById('viz-toggle-treemap-labels');
	if (toggleLabels) {
		toggleLabels.addEventListener('change', () => {
			updateActiveDatasetConfig({
				treemap: { ...dataset.chartConfig.treemap, showLabels: toggleLabels.checked },
			});
			onConfigChanged?.();
		});
	}

	const toggleValues = document.getElementById('viz-toggle-treemap-values');
	if (toggleValues) {
		toggleValues.addEventListener('change', () => {
			updateActiveDatasetConfig({
				treemap: { ...dataset.chartConfig.treemap, showValues: toggleValues.checked },
			});
			onConfigChanged?.();
		});
	}

	const selectColorMode = document.getElementById('viz-select-treemap-color-mode');
	if (selectColorMode) {
		selectColorMode.addEventListener('change', () => {
			const nextMode = ['scheme', 'uniform'].includes(selectColorMode.value) ? selectColorMode.value : 'scheme';
			updateActiveDatasetConfig({
				treemap: { ...dataset.chartConfig.treemap, colorMode: nextMode },
			});
			onConfigChanged?.();
		});
	}

	setupColorInputListener('viz-input-treemap-color', 'color', CHART_COLORS.treemap, dataset, 'treemap', onConfigChanged);

	const presetButtons = document.querySelectorAll('button[data-color-preset-control="viz-treemap-color-preset"]');
	presetButtons.forEach(button => {
		button.addEventListener('click', () => {
			const presetName = button.dataset.presetName;
			const palette = COLOR_PRESETS[presetName] || [];
			if (palette.length === 0) return;
			updateActiveDatasetConfig({
				treemap: {
					...dataset.chartConfig.treemap,
					colorScheme: presetName,
					color: normalizeHexColor(palette[0], CHART_COLORS.treemap),
				},
			});
			onConfigChanged?.();
		});
	});
}
