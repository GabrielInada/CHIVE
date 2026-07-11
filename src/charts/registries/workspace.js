/**
 * Dataset-workspace chart integration registry.
 *
 * Entries normalize package and legacy workspace sections to one context
 * shape. This registry owns workspace rendering only; it does not import
 * controls, panel adapters, state, or services.
 *
 * @typedef {import('../../types.js').ChartTypeKey} ChartTypeKey
 * @typedef {{
 *   config: Object,
 *   rows: Array<Object<string, *>>,
 *   columnTypeByName: Object<string, string>,
 *   filterCallbacks: Object
 * }} WorkspaceChartContext
 */

import { CHART_TYPE_KEYS } from '../../config/chartTypes.js';
import { renderBarChartSection } from '../bar/workspaceSection.js';
import { renderScatter3dChartSection } from '../scatter3d/workspaceSection.js';
import { renderLineChartSection } from '../line/workspaceSection.js';
import { renderScatterChartSection } from '../scatter/workspaceSection.js';
import { renderPieChartSection } from '../pie/workspaceSection.js';
import { renderBubbleChartSection } from '../bubble/workspaceSection.js';
import { renderNetworkChartSection } from '../../components/datasetWorkspace/chartRenders/networkChartSection.js';
import { renderTreemapChartSection } from '../treemap/workspaceSection.js';
import { renderTinChartSection } from '../../components/datasetWorkspace/chartRenders/tinChartSection.js';

/** @type {Readonly<Object<ChartTypeKey, (context: WorkspaceChartContext) => void>>} */
const WORKSPACE_RENDERERS = Object.freeze({
	bar: ({ config, rows, filterCallbacks }) => {
		renderBarChartSection({ config, rows, filterCallbacks });
	},
	line: ({ config, rows, columnTypeByName, filterCallbacks }) => {
		renderLineChartSection({ config, rows, columnTypeByName, filterCallbacks });
	},
	scatter: ({ config, rows, columnTypeByName, filterCallbacks }) => {
		renderScatterChartSection({ config, rows, columnTypeByName, filterCallbacks });
	},
	scatter3d: ({ config, rows }) => {
		renderScatter3dChartSection({ config, rows });
	},
	pie: ({ config, rows, filterCallbacks }) => {
		renderPieChartSection({ config, rows, filterCallbacks });
	},
	bubble: ({ config, rows, filterCallbacks }) => {
		renderBubbleChartSection({ config, rows, filterCallbacks });
	},
	network: ({ config, rows, filterCallbacks }) => {
		renderNetworkChartSection({ config, rows, filterCallbacks });
	},
	treemap: ({ config, rows, filterCallbacks }) => {
		renderTreemapChartSection({ config, rows, filterCallbacks });
	},
	tin: ({ config, rows }) => {
		renderTinChartSection({ config, rows });
	},
});

/**
 * Chart types with workspace renderers, in canonical chart order.
 *
 * @type {ReadonlyArray<ChartTypeKey>}
 */
export const SUPPORTED_WORKSPACE_CHART_TYPES = Object.freeze(
	CHART_TYPE_KEYS.filter(type => Object.hasOwn(WORKSPACE_RENDERERS, type)),
);

/**
 * Dispatch one chart workspace section. Unknown keys return `false`; known
 * keys invoke exactly one renderer and return `true`.
 *
 * @param {string} chartType
 * @param {WorkspaceChartContext} context
 * @returns {boolean}
 */
export function renderWorkspaceChart(chartType, context) {
	if (!Object.hasOwn(WORKSPACE_RENDERERS, chartType)) return false;
	WORKSPACE_RENDERERS[chartType](context);
	return true;
}
