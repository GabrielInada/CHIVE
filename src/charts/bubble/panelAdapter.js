/**
 * Bubble-chart panel adapter. Maps a captured chart snapshot onto the package's
 * shared presentation flow without exposing panel internals to the renderer.
 *
 * @typedef {import('../../types.js').ChartSnapshot} ChartSnapshot
 */

import { renderBubbleInto } from './presentation.js';

/**
 * Render a bubble-chart snapshot into a panel slot.
 *
 * @param {HTMLElement} container
 * @param {ChartSnapshot} spec
 * @returns {import('../../types.js').Result}
 */
export function renderBubblePanelChart(container, spec) {
	return renderBubbleInto(container, spec.dataSnapshot, spec.config || {});
}
