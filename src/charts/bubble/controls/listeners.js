/**
 * Bubble-chart controls: listener wiring.
 *
 * Wires every bubble-chart control, including the progressive nesting selects
 * (level N+1 appears only after level N is filled) and the `measureMode` <->
 * `valueColumn` cross-constraint. The shared `resolveNestingColumnsFromConfig`
 * (canonical `nestingColumns` with legacy `groupColumn` migration) lives in
 * `nestingColumns.js` alongside the builder.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 * @typedef {import('../../../types.js').ChartConfigWriter} ChartConfigWriter
 */

import { BUBBLE_CHART } from '../../../config/charts/definitions/bubble.js';
import { normalizeColumnNameList } from '../../../domain/datasets/columns.js';
import { COLOR_PRESETS } from '../../shared/controls/factories.js';
import {
	setupSelectListeners,
	setupSliderListener,
	setupTextInputListener,
	setupColorPresetListeners,
} from '../../shared/controls/listenerBindings.js';
import { resolveNestingColumnsFromConfig, computeNestingControlCount } from './nestingColumns.js';

/**
 * Wire listeners for every bubble-chart control. Handles the progressive
 * nesting selects (level N+1 appears only after level N is filled) and the
 * `measureMode` <-> `valueColumn` cross-constraint.
 *
 * @param {Dataset} dataset
 * @param {string[]} baseBubble - Categorical (or fallback "all") column names; kept for parity.
 * @param {string[]} numericOptions - Numeric column names; used to validate the value-column select.
 * @param {string[]} allColumns - Visible column names; an empty array means allow-nothing.
 * @param {ChartConfigWriter} writer
 * @returns {void}
 */
export function setupBubbleChartControlListeners(dataset, baseBubble, numericOptions, allColumns, writer) {

	setupSelectListeners([
		{ id: 'viz-select-bubble-category', key: 'category' },
		{ id: 'viz-select-bubble-nesting-mode', key: 'nestingMode', transform: v => (BUBBLE_CHART.nestingModes.includes(v) ? v : BUBBLE_CHART.defaultNestingMode) },
		{ id: 'viz-select-bubble-topn', key: 'topN', transform: v => Number(v) },
		{ id: 'viz-select-bubble-label-mode', key: 'labelMode', transform: v => (['all', 'hover', 'auto'].includes(v) ? v : 'auto') },
	], writer);

	// Allowlist of eligible (visible, non-category) columns, so the write sink
	// cannot store a column the user cannot see. An empty array means
	// allow-nothing.
	const category = dataset.chartConfig.bubble.category;
	const allowed = new Set(
		normalizeColumnNameList(allColumns, { max: Infinity }).filter(name => name !== category),
	);

	// Progressive nesting level listeners. The wiring count comes from the same
	// shared helper as the builder, so the two never disagree on the level set.
	const maxLevels = computeNestingControlCount(dataset.chartConfig.bubble, allowed);
	for (let i = 0; i < maxLevels; i++) {
		const selectEl = document.getElementById(`viz-select-bubble-nesting-level-${i}`);
		if (!selectEl) continue;
		const levelIndex = i;
		selectEl.addEventListener('change', () => {
			const currentNesting = resolveNestingColumnsFromConfig(dataset.chartConfig.bubble, allowed);
			const newValue = selectEl.value || null;
			const updated = currentNesting.slice(0, levelIndex);
			if (newValue) {
				// Set this level; deeper levels were already truncated by the slice.
				updated[levelIndex] = newValue;
			}
			// Normalize at the write sink so even a forged option cannot persist an
			// out-of-allowlist or over-cap entry.
			const normalized = normalizeColumnNameList(updated, { allowed, max: BUBBLE_CHART.maxNestingDepth });
			writer.commit({
				nestingColumns: normalized,
				groupColumn: normalized[0] || null,
			});
		});
	}

	const measureSelect = document.getElementById('viz-select-bubble-measure');
	if (measureSelect) {
		measureSelect.addEventListener('change', () => {
			const nextMode = BUBBLE_CHART.measureModes.includes(measureSelect.value)
				? measureSelect.value
				: BUBBLE_CHART.defaultMeasureMode;
			const currentValueColumn = numericOptions.includes(dataset.chartConfig.bubble?.valueColumn)
				? dataset.chartConfig.bubble?.valueColumn
				: null;
			writer.commit({
				measureMode: nextMode,
				valueColumn: nextMode === 'count' ? null : (currentValueColumn || numericOptions[0] || null),
			});
		});
	}

	const valueSelect = document.getElementById('viz-select-bubble-value-column');
	if (valueSelect) {
		valueSelect.addEventListener('change', () => {
			writer.commit({
				valueColumn: numericOptions.includes(valueSelect.value) ? valueSelect.value : null,
			});
		});
	}

	setupSliderListener('viz-slider-bubble-padding', 'padding', writer);
	setupTextInputListener('viz-input-bubble-title', 'customTitle', writer);
	setupColorPresetListeners('viz-bubble-color-preset', {}, {}, writer, COLOR_PRESETS);
}
