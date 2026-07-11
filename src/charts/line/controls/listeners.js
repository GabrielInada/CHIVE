/**
 * Line-chart controls: listener wiring.
 *
 * Wires every line-chart control element. The X-axis accepts any column from
 * `allOptions`; the Y-axis is restricted to `numericOptions`.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 */

import { CHART_COLORS, LINE_CHART } from '../../../config/charts.js';
import {
	commitChartConfigPatch,
	setupCheckboxListeners,
	setupColorInputListener,
	setupSelectListeners,
	setupSliderListener,
	setupTextInputListener,
} from '../../../modules/chartControls/controlListenerHelpers.js';

/**
 * Wire listeners for every line-chart control element. The X-axis accepts
 * any column from `allOptions`; the Y-axis is restricted to `numericOptions`.
 *
 * @param {Dataset} dataset
 * @param {string[]} numericOptions
 * @param {string[]} dateOptions - Currently unused (reserved for date-axis mode).
 * @param {string[]} allOptions - All visible columns; used to validate the X-axis select.
 * @param {() => void} [onConfigChanged]
 * @returns {void}
 */
export function setupLineChartControlListeners(dataset, numericOptions, dateOptions, allOptions, onConfigChanged) {
	void dateOptions;

	const xSelect = document.getElementById('viz-select-line-x');
	if (xSelect) {
		xSelect.addEventListener('change', () => {
			const selected = allOptions.includes(xSelect.value) ? xSelect.value : null;
			commitChartConfigPatch(dataset, 'line', { x: selected }, onConfigChanged);
		});
	}

	const ySelect = document.getElementById('viz-select-line-y');
	if (ySelect) {
		ySelect.addEventListener('change', () => {
			const selected = numericOptions.includes(ySelect.value) ? ySelect.value : null;
			commitChartConfigPatch(dataset, 'line', { y: selected }, onConfigChanged);
		});
	}

	setupSelectListeners([
		{
			id: 'viz-select-line-curve',
			key: 'curve',
			transform: v => (LINE_CHART.curveOptions.includes(v) ? v : LINE_CHART.defaultCurve),
		},
		{
			id: 'viz-select-line-missing',
			key: 'missingMode',
			transform: v => (LINE_CHART.missingModes.includes(v) ? v : LINE_CHART.defaultMissingMode),
		},
		{
			id: 'viz-select-line-aggregate',
			key: 'aggregateMode',
			transform: v => (LINE_CHART.aggregateModes.includes(v) ? v : LINE_CHART.defaultAggregateMode),
		},
	], dataset, 'line', onConfigChanged);

	setupCheckboxListeners([
		{ id: 'viz-toggle-line-sort-x', key: 'sortX' },
		{ id: 'viz-toggle-line-show-points', key: 'showPoints' },
		{ id: 'viz-toggle-line-x-label', key: 'showXAxisLabel' },
		{ id: 'viz-toggle-line-y-label', key: 'showYAxisLabel' },
	], dataset, 'line', onConfigChanged);

	setupTextInputListener('viz-input-line-title', 'customTitle', dataset, 'line', onConfigChanged);
	setupSliderListener('viz-slider-line-stroke-width', 'strokeWidth', dataset, 'line', onConfigChanged);

	setupColorInputListener('viz-input-line-color', 'color', CHART_COLORS.line, dataset, 'line', onConfigChanged);
	setupColorInputListener('viz-input-line-ghost-color', 'ghostStrokeColor', LINE_CHART.defaultGhostStrokeColor, dataset, 'line', onConfigChanged);
}
