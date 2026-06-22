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
 */

import { BUBBLE_CHART } from '../../../config/charts.js';
import { updateActiveDatasetConfig } from '../../state/appState.js';
import { COLOR_PRESETS } from '../shared.js';
import {
	setupSelectListeners,
	setupSliderListener,
	setupTextInputListener,
	setupColorPresetListeners,
} from '../controlListenerHelpers.js';
import { resolveNestingColumnsFromConfig } from './nestingColumns.js';

/**
 * Wire listeners for every bubble-chart control. Handles the progressive
 * nesting selects (level N+1 appears only after level N is filled) and the
 * `measureMode` <-> `valueColumn` cross-constraint.
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
	const nestingColumns = resolveNestingColumnsFromConfig(dataset.chartConfig.bubble);
	const maxLevels = nestingColumns.length + 1;
	for (let i = 0; i < maxLevels; i++) {
		const selectEl = document.getElementById(`viz-select-bubble-nesting-level-${i}`);
		if (!selectEl) continue;
		const levelIndex = i;
		selectEl.addEventListener('change', () => {
			const currentNesting = resolveNestingColumnsFromConfig(dataset.chartConfig.bubble);
			const newValue = selectEl.value || null;
			if (newValue) {
				// Set this level and truncate deeper levels
				const updated = currentNesting.slice(0, levelIndex);
				updated[levelIndex] = newValue;
				updateActiveDatasetConfig({
					bubble: {
						...dataset.chartConfig.bubble,
						nestingColumns: updated,
						groupColumn: updated[0] || null,
					},
				});
			} else {
				// Clearing this level: truncate from this level onward
				const updated = currentNesting.slice(0, levelIndex);
				updateActiveDatasetConfig({
					bubble: {
						...dataset.chartConfig.bubble,
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
			const currentValueColumn = numericOptions.includes(dataset.chartConfig.bubble?.valueColumn)
				? dataset.chartConfig.bubble?.valueColumn
				: null;
			updateActiveDatasetConfig({
				bubble: {
					...dataset.chartConfig.bubble,
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
			updateActiveDatasetConfig({
				bubble: {
					...dataset.chartConfig.bubble,
					valueColumn: numericOptions.includes(valueSelect.value) ? valueSelect.value : null,
				},
			});
			onConfigChanged?.();
		});
	}

	setupSliderListener('viz-slider-bubble-padding', 'padding', dataset, 'bubble', onConfigChanged);
	setupTextInputListener('viz-input-bubble-title', 'customTitle', dataset, 'bubble', onConfigChanged);
	setupColorPresetListeners('viz-bubble-color-preset', {}, {}, dataset, 'bubble', onConfigChanged, COLOR_PRESETS);
}
