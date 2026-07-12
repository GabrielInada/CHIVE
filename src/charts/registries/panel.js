/**
 * Panel chart integration registry.
 *
 * Package adapters use the shared `(container, snapshot) => Result` contract.
 * This registry owns panel rendering only; it does not import controls,
 * workspace components, state, or services.
 *
 * @typedef {import('../../types.js').ChartSnapshot} ChartSnapshot
 * @typedef {import('../../types.js').Result} Result
 * @typedef {import('../../types.js').ChartTypeKey} ChartTypeKey
 * @typedef {(container: HTMLElement, spec: ChartSnapshot) => Result} PanelChartRenderer
 */

import { CHART_TYPE_KEYS } from '../../config/chartTypes.js';
import { renderBarPanelChart } from '../bar/panelAdapter.js';
import { renderBubblePanelChart } from '../bubble/panelAdapter.js';
import { renderLinePanelChart } from '../line/panelAdapter.js';
import { renderNetworkPanelChart } from '../network/panelAdapter.js';
import { renderPiePanelChart } from '../pie/panelAdapter.js';
import { renderScatterPanelChart } from '../scatter/panelAdapter.js';
import { renderScatter3dPanelChart } from '../scatter3d/panelAdapter.js';
import { renderTreemapPanelChart } from '../treemap/panelAdapter.js';
import { renderTinPanelChart } from '../tin/panelAdapter.js';

/** @type {Readonly<Object<ChartTypeKey, PanelChartRenderer>>} */
const PANEL_RENDERERS = Object.freeze({
	bar: renderBarPanelChart,
	line: renderLinePanelChart,
	scatter: renderScatterPanelChart,
	scatter3d: renderScatter3dPanelChart,
	pie: renderPiePanelChart,
	bubble: renderBubblePanelChart,
	network: renderNetworkPanelChart,
	treemap: renderTreemapPanelChart,
	tin: renderTinPanelChart,
});

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
