/**
 * Treemap controls: listener wiring.
 *
 * Wires every treemap control. Handles the `measureMode` ↔ `valueColumn`
 * cross-constraint and the color-preset → primary-color mapping.
 *
 * Standard controls use the shared chart-control listener adapters. Measure
 * and value-column changes keep small custom handlers for their cross-field
 * validation.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 */

import { CHART_COLORS, TREEMAP_CHART } from '../../../config/charts.js';
import { COLOR_PRESETS } from '../../shared/controls/factories.js';
import {
	commitChartConfigPatch,
	setupCheckboxListeners,
	setupColorInputListener,
	setupColorPresetListeners,
	setupSelectListeners,
	setupSliderListener,
	setupTextInputListener,
} from '../../../modules/chartControls/controlListenerHelpers.js';

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

	setupSelectListeners([
		{ id: 'viz-select-treemap-category', key: 'category', transform: value => value || null },
		{ id: 'viz-select-treemap-topn', key: 'topN', transform: value => Number(value) },
		{
			id: 'viz-select-treemap-color-mode',
			key: 'colorMode',
			transform: value => ['scheme', 'uniform'].includes(value) ? value : 'scheme',
		},
	], dataset, 'treemap', onConfigChanged);

	const selectMeasure = document.getElementById('viz-select-treemap-measure');
	if (selectMeasure) {
		selectMeasure.addEventListener('change', () => {
			const nextMode = TREEMAP_CHART.measureModes.includes(selectMeasure.value) ? selectMeasure.value : 'count';
			const currentValueColumn = numericOptions.includes(dataset.chartConfig.treemap?.valueColumn)
				? dataset.chartConfig.treemap?.valueColumn
				: null;
			commitChartConfigPatch(dataset, 'treemap', {
				measureMode: nextMode,
				valueColumn: nextMode === 'count' ? null : currentValueColumn,
			}, onConfigChanged);
		});
	}

	const selectValueColumn = document.getElementById('viz-select-treemap-value-column');
	if (selectValueColumn) {
		selectValueColumn.addEventListener('change', () => {
			const nextValue = numericOptions.includes(selectValueColumn.value) ? selectValueColumn.value : null;
			commitChartConfigPatch(dataset, 'treemap', {
				valueColumn: nextValue,
			}, onConfigChanged);
		});
	}

	setupTextInputListener('viz-input-treemap-title', 'customTitle', dataset, 'treemap', onConfigChanged);
	setupSliderListener('viz-slider-treemap-padding', 'padding', dataset, 'treemap', onConfigChanged);
	setupCheckboxListeners([
		{ id: 'viz-toggle-treemap-labels', key: 'showLabels' },
		{ id: 'viz-toggle-treemap-values', key: 'showValues' },
	], dataset, 'treemap', onConfigChanged);
	setupColorInputListener('viz-input-treemap-color', 'color', CHART_COLORS.treemap, dataset, 'treemap', onConfigChanged);
	setupColorPresetListeners(
		'viz-treemap-color-preset',
		{ color: 0 },
		{ color: CHART_COLORS.treemap },
		dataset,
		'treemap',
		onConfigChanged,
		COLOR_PRESETS,
	);
}
