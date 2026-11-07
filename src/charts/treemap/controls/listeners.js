/**
 * Treemap controls: listener wiring.
 *
 * Wires every treemap control. Handles the `measureMode` ↔ `valueColumn`
 * cross-constraint and the color-preset → primary-color mapping.
 *
 * Standard controls use the shared chart-control listener adapters, and the
 * measure uses the shared measure listener. The value-column change keeps a
 * small custom handler that checks the column against the numeric options.
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
	setupMeasureListener,
	setupValueColumnListener,
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
		{ id: 'viz-select-treemap-color-mode', key: 'colorMode' },
	], writer);

	setupMeasureListener('viz-select-treemap-measure', () => dataset.chartConfig.treemap.valueColumn, numericOptions, writer);
	setupValueColumnListener('viz-select-treemap-value-column', numericOptions, writer);

	setupTextInputListener('viz-input-treemap-title', 'customTitle', writer);
	setupSliderListener('viz-slider-treemap-padding', 'padding', writer);
	setupCheckboxListeners([
		{ id: 'viz-toggle-treemap-labels', key: 'showLabels' },
		{ id: 'viz-toggle-treemap-values', key: 'showValues' },
	], writer);
	setupColorInputListener('viz-input-treemap-color', 'color', CHART_COLORS.treemap, writer);
	setupColorPresetListeners(
		'viz-treemap-color-preset',
		TREEMAP_CHART.presetColorKeys,
		{ color: CHART_COLORS.treemap }, writer, COLOR_PRESETS,
	);
}
