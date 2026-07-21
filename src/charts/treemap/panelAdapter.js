/**
 * Treemap panel adapter. Maps a captured chart snapshot onto the package's
 * shared presentation flow without exposing panel internals to the renderer.
 *
 * @typedef {import('../../types.js').ChartSnapshot} ChartSnapshot
 */

import { renderTreemapInto } from './presentation.js';

/**
 * Render a treemap snapshot into a panel slot.
 *
 * @param {HTMLElement} container
 * @param {ChartSnapshot} spec
 * @returns {import('../../types.js').Result}
 */
export function renderTreemapPanelChart(container, spec) {
	return renderTreemapInto(container, spec.dataSnapshot, spec.config || {});
}
