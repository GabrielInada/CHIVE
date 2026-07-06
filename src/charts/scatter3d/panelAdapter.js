/**
 * 3D-scatter panel adapter. Maps a frozen `ChartSnapshot` onto the
 * package's presentation flow for `panelSubsystem/renderChartFromSpec.js`.
 * Snapshot data and config are read-only inputs; the adapter owns no
 * state and receives the slot container from the panel.
 *
 * @typedef {import('../../types.js').ChartSnapshot} ChartSnapshot
 */

import { renderScatter3dInto } from './presentation.js';

/**
 * Render a 3D-scatter snapshot into a panel slot container.
 *
 * @param {HTMLElement} container
 * @param {ChartSnapshot} spec
 * @returns {import('../../types.js').Result}
 */
export function renderScatter3dPanelChart(container, spec) {
	const config = spec.config || {};
	const rows = Array.isArray(spec.dataSnapshot) ? spec.dataSnapshot : [];
	return renderScatter3dInto(container, rows, config);
}
