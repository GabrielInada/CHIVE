/**
 * 3D-scatter control listeners.
 *
 * Wires the right-sidebar 3D-scatter controls to the active dataset
 * config through the shared chartControls listener helpers (which own
 * the config-write path): the X/Y/Z numeric clamp, the title, the point
 * size and opacity sliders, and the point color.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 */

import { CHART_COLORS } from '../../../config/charts.js';
import {
	setupSelectListeners,
	setupTextInputListener,
	setupColorInputListener,
	setupSliderListener,
} from '../../../modules/chartControls/controlListenerHelpers.js';

/**
 * Wire listeners for every 3D-scatter control. X/Y/Z selects clamp to
 * `numericOptions`; out-of-list values reset to `null`.
 *
 * @param {Dataset} dataset
 * @param {string[]} numericOptions
 * @param {string[]} allColumns - Currently unused.
 * @param {() => void} [onConfigChanged]
 * @returns {void}
 */
export function setupScatter3dControlListeners(dataset, numericOptions, allColumns, onConfigChanged) {
	void allColumns;

	setupSelectListeners([
		{
			id: 'viz-select-scatter3d-x',
			key: 'x',
			transform: v => (numericOptions.includes(v) ? v : null),
		},
		{
			id: 'viz-select-scatter3d-y',
			key: 'y',
			transform: v => (numericOptions.includes(v) ? v : null),
		},
		{
			id: 'viz-select-scatter3d-z',
			key: 'z',
			transform: v => (numericOptions.includes(v) ? v : null),
		},
	], dataset, 'scatter3d', onConfigChanged);

	setupTextInputListener('viz-input-scatter3d-title', 'customTitle', dataset, 'scatter3d', onConfigChanged);
	setupSliderListener('viz-slider-scatter3d-point-size', 'pointSize', dataset, 'scatter3d', onConfigChanged);
	setupSliderListener('viz-slider-scatter3d-opacity', 'opacity', dataset, 'scatter3d', onConfigChanged);
	setupColorInputListener('viz-input-scatter3d-color', 'color', CHART_COLORS.scatter3d, dataset, 'scatter3d', onConfigChanged);
}
