/**
 * Network-graph panel adapter. Maps a frozen chart snapshot onto the package's
 * shared presentation flow without exposing panel internals to the renderer.
 *
 * Panel snapshots are frozen, so no filter callbacks are passed: panel
 * tooltips cannot mutate the live dataset.
 *
 * @typedef {import('../../types.js').ChartSnapshot} ChartSnapshot
 */

import { renderNetworkInto } from './presentation.js';

/**
 * Render a network-graph snapshot into a panel slot.
 *
 * @param {HTMLElement} container
 * @param {ChartSnapshot} spec
 * @returns {import('../../types.js').Result}
 */
export function renderNetworkPanelChart(container, spec) {
	return renderNetworkInto(container, spec.dataSnapshot, spec.config || {});
}
