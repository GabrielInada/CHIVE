/**
 * Panel chart integration registry.
 *
 * Turns a captured chart snapshot into the chart input and hands it to the
 * chart's presentation flow, the same one Visualizations draws with, under the
 * shared `(container, snapshot) => Result` contract. Panel passes no filter
 * callbacks, so its tooltips cannot change the live dataset. This registry
 * owns panel rendering only; it does not import controls, the workspace
 * registry, state, or services.
 *
 * @typedef {import('../../types.js').ChartSnapshot} ChartSnapshot
 * @typedef {import('../../types.js').ChartInput} ChartInput
 * @typedef {import('../../types.js').Result} Result
 * @typedef {import('../../types.js').ChartTypeKey} ChartTypeKey
 * @typedef {(container: HTMLElement, snapshot: ChartSnapshot) => Result} PanelChartRenderer
 */

import { CHART_TYPE_KEYS } from '../../config/charts/definitions.js';
import { getColumnTypesByName } from '../../domain/datasets/columns.js';
import { renderBarInto } from '../bar/presentation.js';
import { renderBubbleInto } from '../bubble/presentation.js';
import { renderLineInto } from '../line/presentation.js';
import { renderNetworkInto } from '../network/presentation.js';
import { renderPieInto } from '../pie/presentation.js';
import { renderScatterInto } from '../scatter/presentation.js';
import { renderScatter3dInto } from '../scatter3d/presentation.js';
import { renderTinInto } from '../tin/presentation.js';
import { renderTreemapInto } from '../treemap/presentation.js';

/**
 * The chart input for a capture. Missing rows draw as no rows and a missing
 * config as an empty one; column types come from every captured column, as
 * Visualizations takes them from every dataset column.
 *
 * @param {HTMLElement} container
 * @param {ChartSnapshot} snapshot
 * @returns {ChartInput}
 */
function inputOf(container, snapshot) {
	const config = snapshot.config || {};
	// Layout height is a presentation concern. Draw at the slot's height so
	// stacked phone charts keep legible text without rewriting the capture.
	const slotHeight = container.classList.contains('panel-chart-container') ? container.clientHeight : 0;
	return {
		rows: Array.isArray(snapshot.dataSnapshot) ? snapshot.dataSnapshot : [],
		config: slotHeight > 0 ? { ...config, chartHeight: slotHeight } : config,
		columnTypeByName: getColumnTypesByName(snapshot.columnsSnapshot),
	};
}

/** @type {Readonly<Object<ChartTypeKey, PanelChartRenderer>>} */
const PANEL_RENDERERS = Object.freeze(Object.fromEntries(Object.entries({
	bar: renderBarInto,
	line: renderLineInto,
	scatter: renderScatterInto,
	scatter3d: renderScatter3dInto,
	pie: renderPieInto,
	bubble: renderBubbleInto,
	network: renderNetworkInto,
	treemap: renderTreemapInto,
	tin: renderTinInto,
}).map(([type, present]) => [type, (container, snapshot) => present(container, inputOf(container, snapshot))])));

/**
 * Chart types with panel renderers, in canonical chart order.
 *
 * @type {ReadonlyArray<ChartTypeKey>}
 */
export const SUPPORTED_PANEL_CHART_TYPES = Object.freeze(
	CHART_TYPE_KEYS.filter(type => Object.hasOwn(PANEL_RENDERERS, type)),
);

/**
 * Resolve a panel renderer for a chart snapshot. Unknown keys return `null`.
 *
 * @param {string} chartType
 * @returns {PanelChartRenderer | null}
 */
export function getPanelChartRenderer(chartType) {
	return Object.hasOwn(PANEL_RENDERERS, chartType)
		? PANEL_RENDERERS[chartType]
		: null;
}
