/**
 * Dataset-workspace chart integration registry.
 *
 * Owns the Visualizations section of every chart: block visibility, the
 * container's min height, and handing the chart input to the chart's
 * presentation flow, which draws the chart or its empty-state message. This
 * registry owns workspace rendering only; it does not import controls, the
 * panel registry, state, or services.
 *
 * @typedef {import('../../types.js').ChartTypeKey} ChartTypeKey
 * @typedef {import('../../types.js').ChartInput} ChartInput
 */

import { CHART_TYPE_KEYS } from '../../config/charts/definitions.js';
import { CHART_BLOCKS, CHART_CONTAINERS } from '../workspaceDomIds.js';
import { clearChartContainer } from '../shared/containerLifecycle.js';
import { resolveChartHeight } from '../shared/chartHeight.js';
import { renderBarInto } from '../bar/presentation.js';
import { renderBubbleInto } from '../bubble/presentation.js';
import { renderLineInto } from '../line/presentation.js';
import { renderNetworkInto } from '../network/presentation.js';
import { renderPieInto } from '../pie/presentation.js';
import { renderScatterInto } from '../scatter/presentation.js';
import { renderScatter3dInto } from '../scatter3d/presentation.js';
import { renderTinInto } from '../tin/presentation.js';
import { renderTreemapInto } from '../treemap/presentation.js';

/** @type {Readonly<Object<ChartTypeKey, (container: HTMLElement, input: ChartInput) => *>>} */
const PRESENTATIONS = Object.freeze({
	bar: renderBarInto,
	line: renderLineInto,
	scatter: renderScatterInto,
	scatter3d: renderScatter3dInto,
	pie: renderPieInto,
	bubble: renderBubbleInto,
	network: renderNetworkInto,
	treemap: renderTreemapInto,
	tin: renderTinInto,
});

/**
 * Chart types with workspace renderers, in canonical chart order.
 *
 * @type {ReadonlyArray<ChartTypeKey>}
 */
export const SUPPORTED_WORKSPACE_CHART_TYPES = Object.freeze(
	CHART_TYPE_KEYS.filter(type => Object.hasOwn(PRESENTATIONS, type)),
);

/**
 * Render one chart's Visualizations section. A disabled chart hides its block
 * and clears its container through the dispose contract, which also cancels a
 * render still loading. An enabled chart shows its block, takes the height it
 * is drawn at as its min height, and draws. A missing block or container is
 * skipped. Unknown keys return `false`; known keys return `true`.
 *
 * @param {string} chartType
 * @param {ChartInput} input - `input.config` is the chart's config block.
 * @returns {boolean}
 */
export function renderWorkspaceChart(chartType, input) {
	if (!Object.hasOwn(PRESENTATIONS, chartType)) return false;
	const block = document.getElementById(CHART_BLOCKS[chartType]);
	const container = document.getElementById(CHART_CONTAINERS[chartType]);
	if (!input.config?.enabled) {
		if (block) block.hidden = true;
		clearChartContainer(container);
		return true;
	}
	if (block) block.hidden = false;
	if (!container) return true;
	container.style.minHeight = `${resolveChartHeight(chartType, input.config.chartHeight)}px`;
	PRESENTATIONS[chartType](container, input);
	return true;
}
