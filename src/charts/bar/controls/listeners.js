/**
 * Bar-chart controls: listener wiring.
 *
 * Attaches listeners to the control elements produced by the builder. Each
 * listener mutates the active dataset's `chartConfig.bar` through the shared
 * chart-control config adapter and calls back into the host so the chart
 * re-renders.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 * @typedef {import('../../../types.js').ChartConfigWriter} ChartConfigWriter
 */

import { CHART_COLORS } from '../../../config/charts.js';
import { COLOR_PRESETS } from '../../shared/controls/factories.js';
import {
	setupSelectListeners,
	setupCheckboxListeners,
	setupTextInputListener,
	setupColorInputListener,
	setupSliderListener,
	setupColorPresetListeners,
} from '../../shared/controls/listenerBindings.js';

/**
 * Wire listeners for every bar-chart control element produced by
 * `createBarChartControls`. Writes `dataset.chartConfig.bar` through the
 * injected {@link ChartConfigWriter}, which owns the state write and the
 * host re-render.
 *
 * @param {Dataset} dataset
 * @param {string[]} baseBar - Categorical (or fallback "all") column names; kept for parity with the listener signature, currently unused.
 * @param {string[]} numericOptions - Numeric column names; used to validate the value-column select.
 * @param {string[]} allColumns - Visible column names.
 * @param {ChartConfigWriter} writer
 * @returns {void}
 */
export function setupBarChartControlListeners(dataset, baseBar, numericOptions, allColumns, writer) {

	// --- Data controls ---
	setupSelectListeners([
		{ id: 'viz-select-bar', key: 'category' },
		{ id: 'viz-select-bar-sort', key: 'sort' },
		{ id: 'viz-select-bar-topn', key: 'topN', transform: v => Number(v) },
	], writer);

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
			writer.commit({
				measureMode: nextMode,
				valueColumn: nextMode === 'count' ? null : currentValueColumn,
			});
		});
	}

	// Value column (custom validation against numericOptions)
	const selectBarValueColumn = document.getElementById('viz-select-bar-value-column');
	if (selectBarValueColumn) {
		selectBarValueColumn.addEventListener('change', () => {
			writer.commit({
				valueColumn: numericOptions.includes(selectBarValueColumn.value)
					? selectBarValueColumn.value
					: null,
			});
		});
	}

	// --- Styling controls ---
	setupColorInputListener('viz-input-bar-color', 'color', CHART_COLORS.bar, writer);
	setupSelectListeners([
		{ id: 'viz-select-bar-color-mode', key: 'colorMode', transform: v =>
			['uniform', 'gradient', 'gradient-manual'].includes(v) ? v : 'uniform' },
	], writer);
	setupColorInputListener('viz-input-bar-gradient-min', 'gradientMinColor', CHART_COLORS.bar, writer);
	setupColorInputListener('viz-input-bar-gradient-max', 'gradientMaxColor', '#ffffff', writer);
	setupSelectListeners([
		{ id: 'viz-select-bar-gradient-distribution', key: 'gradientDistribution', transform: v =>
			['value', 'rank'].includes(v) ? v : 'value' },
	], writer);
	setupSliderListener('viz-slider-bar-threshold', 'manualThresholdPct', writer);
	setupColorPresetListeners('viz-bar-color-preset', {
		color: 0, gradientMinColor: 0, gradientMaxColor: -1,
	}, { color: CHART_COLORS.bar, gradientMinColor: CHART_COLORS.bar, gradientMaxColor: '#ffffff' }, writer, COLOR_PRESETS);

	// --- Display controls ---
	setupCheckboxListeners([
		{ id: 'viz-toggle-bar-x-label', key: 'showXAxisLabel' },
		{ id: 'viz-toggle-bar-y-label', key: 'showYAxisLabel' },
	], writer);
	setupTextInputListener('viz-input-bar-title', 'customTitle', writer);
}
