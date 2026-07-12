/**
 * Network-graph controls: listener wiring.
 *
 * Wires every network-graph control, including the Reset Zoom button (resets
 * both slider DOM and config) and the color-preset to source/target mapping.
 * Config writes go through the shared chart-control listener helpers, so the
 * package never touches state facades directly.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 */

import { NETWORK_GRAPH } from '../../../config/charts.js';
import { COLOR_PRESETS } from '../../shared/controls/factories.js';
import {
	commitChartConfigPatch,
	setupSelectListeners,
	setupCheckboxListeners,
	setupTextInputListener,
	setupColorInputListener,
	setupSliderListeners,
	setupColorPresetListeners,
} from '../../../modules/chartControls/controlListenerHelpers.js';

/**
 * Wire listeners for every network-graph control. Includes the Reset Zoom
 * button (resets both slider DOM and config). `numericOptionsOrCallback`
 * is overloaded: callers may pass the callback in arg 3 or arg 4.
 *
 * @param {Dataset} dataset
 * @param {string[]} allOptions
 * @param {string[] | (() => void)} [numericOptionsOrCallback]
 * @param {() => void} [onConfigChangedMaybe]
 * @returns {void}
 */
export function setupNetworkGraphControlListeners(dataset, allOptions, numericOptionsOrCallback = [], onConfigChangedMaybe) {
	const onConfigChanged = typeof numericOptionsOrCallback === 'function'
		? numericOptionsOrCallback
		: onConfigChangedMaybe;

	setupSelectListeners([
		{ id: 'viz-select-network-source', key: 'source' },
		{ id: 'viz-select-network-target', key: 'target' },
		{ id: 'viz-select-network-weight', key: 'weight', transform: v => v || null },
		{ id: 'viz-select-network-group', key: 'group', transform: v => v || null },
		{ id: 'viz-select-network-edge-color-mode', key: 'edgeColorMode', transform: v => v === 'uniform' ? 'uniform' : 'gradient' },
	], dataset, 'network', onConfigChanged);

	setupSliderListeners([
		{ id: 'viz-slider-network-node-radius', key: 'nodeRadius' },
		{ id: 'viz-slider-network-link-distance', key: 'linkDistance' },
		{ id: 'viz-slider-network-charge', key: 'chargeStrength' },
		{ id: 'viz-slider-network-link-opacity', key: 'linkOpacity' },
		{ id: 'viz-slider-network-zoom', key: 'zoomScale' },
		{ id: 'viz-slider-network-alpha-decay', key: 'alphaDecay' },
	], dataset, 'network', onConfigChanged);

	// Reset zoom button (custom: resets slider DOM + config)
	const networkZoomSlider = document.getElementById('viz-slider-network-zoom');
	const resetNetworkZoomButton = document.getElementById('viz-btn-network-reset-zoom');
	if (resetNetworkZoomButton) {
		resetNetworkZoomButton.addEventListener('click', () => {
			if (networkZoomSlider) {
				networkZoomSlider.value = String(NETWORK_GRAPH.defaultZoomScale);
				const output = networkZoomSlider.parentElement?.querySelector('output');
				if (output) output.textContent = networkZoomSlider.value;
			}
			commitChartConfigPatch(dataset, 'network', {
				zoomScale: NETWORK_GRAPH.defaultZoomScale,
			}, onConfigChanged);
		});
	}

	setupCheckboxListeners([
		{ id: 'viz-toggle-network-node-labels', key: 'showNodeLabels' },
		{ id: 'viz-toggle-network-show-legend', key: 'showLegend' },
	], dataset, 'network', onConfigChanged);

	setupColorInputListener('viz-input-network-source-color', 'sourceNodeColor', '#e3743d', dataset, 'network', onConfigChanged);
	setupColorInputListener('viz-input-network-target-color', 'targetNodeColor', '#6b94c9', dataset, 'network', onConfigChanged);

	setupColorPresetListeners('viz-network-color-preset', {
		sourceNodeColor: 0, targetNodeColor: 1,
	}, {
		sourceNodeColor: '#e3743d', targetNodeColor: '#6b94c9',
	}, dataset, 'network', onConfigChanged, COLOR_PRESETS);

	setupTextInputListener('viz-input-network-title', 'customTitle', dataset, 'network', onConfigChanged);
}
