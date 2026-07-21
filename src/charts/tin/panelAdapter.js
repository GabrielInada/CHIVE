/**
 * TIN panel adapter. Maps a captured chart snapshot onto the package's shared
 * presentation flow without exposing panel internals to the renderer.
 *
 * @typedef {import('../../types.js').ChartSnapshot} ChartSnapshot
 */

import { renderTinInto } from './presentation.js';

/**
 * Render a TIN snapshot into a panel slot.
 *
 * @param {HTMLElement} container
 * @param {ChartSnapshot} spec
 * @returns {import('../../types.js').Result}
 */
export function renderTinPanelChart(container, spec) {
	return renderTinInto(container, spec.dataSnapshot, spec.config || {});
}
