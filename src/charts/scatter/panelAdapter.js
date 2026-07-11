/**
 * Scatter-plot panel adapter. Maps a frozen chart snapshot onto the package's
 * shared presentation flow without exposing panel internals to the renderer.
 *
 * Panel snapshots are frozen, so no filter callbacks are passed: panel
 * tooltips cannot mutate the live dataset.
 *
 * @typedef {import('../../types.js').ChartSnapshot} ChartSnapshot
 * @typedef {import('../../types.js').ColumnSpec} ColumnSpec
 * @typedef {import('../../types.js').ColumnType} ColumnType
 */

import { renderScatterInto } from './presentation.js';

/**
 * Build a column-type lookup from a panel snapshot.
 *
 * @param {ColumnSpec[] | null | undefined} columnsSnapshot
 * @returns {Object<string, ColumnType>}
 */
function buildColumnTypeIndex(columnsSnapshot) {
	if (!Array.isArray(columnsSnapshot)) return {};
	const index = {};
	for (const column of columnsSnapshot) {
		if (column?.name) index[column.name] = column.type;
	}
	return index;
}

/**
 * Render a scatter-plot snapshot into a panel slot.
 *
 * @param {HTMLElement} container
 * @param {ChartSnapshot} spec
 * @returns {import('../../types.js').Result}
 */
export function renderScatterPanelChart(container, spec) {
	const columnTypeByName = buildColumnTypeIndex(spec.columnsSnapshot);
	return renderScatterInto(container, spec.dataSnapshot, spec.config || {}, columnTypeByName);
}
