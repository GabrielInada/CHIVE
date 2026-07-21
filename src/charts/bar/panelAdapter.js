/**
 * Bar-chart panel adapter. Maps a captured chart snapshot onto the package's
 * shared presentation flow without exposing panel internals to the renderer.
 *
 * @typedef {import('../../types.js').ChartSnapshot} ChartSnapshot
 */

import { renderBarInto } from './presentation.js';

/**
 * Render a bar-chart snapshot into a panel slot.
 *
 * @param {HTMLElement} container
 * @param {ChartSnapshot} spec
 * @returns {import('../../types.js').Result}
 */
export function renderBarPanelChart(container, spec) {
	const config = spec.config || {};
	const rows = Array.isArray(spec.dataSnapshot) ? spec.dataSnapshot : [];
	return renderBarInto(container, rows, config);
}
