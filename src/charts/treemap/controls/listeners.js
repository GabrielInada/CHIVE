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
 * @typedef {import('../../../types.js').ChartConfigWriter} ChartConfigWriter
 */

import { CHART_COLORS } from '../../../config/charts/definitions.js';
import { TREEMAP_CHART } from '../../../config/charts/definitions/treemap.js';
import { COLOR_PRESETS } from '../../shared/controls/factories.js';
import {
	setupCheckboxListeners,
	setupColorInputListener,
	setupColorPresetListeners,
	setupSelectListeners,
	setupSliderListener,
	setupTextInputListener,
} from '../../shared/controls/listenerBindings.js';

/**
 * Wire listeners for every treemap control. Handles the `measureMode` ↔
 * `valueColumn` cross-constraint and color-preset → primary-color mapping.
 *
 * @param {Dataset} dataset
 * @param {string[]} baseCat - Categorical (or fallback "all") column names; kept for parity.
 * @param {string[]} numericOptions
 * @param {string[]} allColumns - Visible column names.
 * @param {ChartConfigWriter} writer
 * @returns {void}
 */
export function setupTreemapControlListeners(dataset, baseCat, numericOptions, allColumns, writer) {

	setupSelectListeners([
		{ id: 'viz-select-treemap-category', key: 'category', transform: value => value || null },
		{ id: 'viz-select-treemap-topn', key: 'topN', transform: value => Number(value) },
		{
			id: 'viz-select-treemap-color-mode',
			key: 'colorMode',
			transform: value => ['scheme', 'uniform'].includes(value) ? value : 'scheme',
		},
	], writer);

	const selectMeasure = document.getElementById('viz-select-treemap-measure');
	if (selectMeasure) {
		selectMeasure.addEventListener('change', () => {
			const nextMode = TREEMAP_CHART.measureModes.includes(selectMeasure.value) ? selectMeasure.value : 'count';
			const currentValueColumn = numericOptions.includes(dataset.chartConfig.treemap?.valueColumn)
				? dataset.chartConfig.treemap?.valueColumn
				: null;
			writer.commit({
				measureMode: nextMode,
				valueColumn: nextMode === 'count' ? null : currentValueColumn,
			});
		});
	}

	const selectValueColumn = document.getElementById('viz-select-treemap-value-column');
	if (selectValueColumn) {
		selectValueColumn.addEventListener('change', () => {
			const nextValue = numericOptions.includes(selectValueColumn.value) ? selectValueColumn.value : null;
			writer.commit({
				valueColumn: nextValue,
			});
		});
	}

	setupTextInputListener('viz-input-treemap-title', 'customTitle', writer);
	setupSliderListener('viz-slider-treemap-padding', 'padding', writer);
	setupCheckboxListeners([
		{ id: 'viz-toggle-treemap-labels', key: 'showLabels' },
		{ id: 'viz-toggle-treemap-values', key: 'showValues' },
	], writer);
	setupColorInputListener('viz-input-treemap-color', 'color', CHART_COLORS.treemap, writer);
	setupColorPresetListeners(
		'viz-treemap-color-preset',
		{ color: 0 },
		{ color: CHART_COLORS.treemap }, writer, COLOR_PRESETS,
	);
}
