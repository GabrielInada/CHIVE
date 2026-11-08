/**
 * Chart controls integration registry.
 *
 * Each entry hands one chart's controls package to the controls sidebar. A
 * chart that describes its controls supplies the descriptions, which the
 * sidebar builds and wires through `charts/shared/controls/describedControls.js`;
 * scatter still pairs a builder with a listener setup. This registry
 * owns controls wiring only; it does not import presentation flows, the other
 * registries, state, or services.
 *
 * @typedef {import('../../types.js').ChartTypeKey} ChartTypeKey
 * @typedef {import('../../types.js').Dataset} Dataset
 * @typedef {import('../../types.js').ChartControlContext} ChartControlContext
 * @typedef {import('../../types.js').ChartConfigWriter} ChartConfigWriter
 * @typedef {import('../../types.js').ChartControlDescriptions} ChartControlDescriptions
 * @typedef {{
 *   controls?: ChartControlDescriptions,
 *   build?: (dataset: Dataset, context: ChartControlContext) => HTMLElement[],
 *   attachListeners?: (dataset: Dataset, context: ChartControlContext, writer: ChartConfigWriter) => void,
 *   computeDefaults: (dataset: Dataset, context: ChartControlContext) => Object
 * }} ChartControlAdapter - `controls` for a chart that describes its controls, otherwise `build` and `attachListeners`.
 */

import { CHART_TYPE_KEYS } from '../../config/charts/definitions.js';
import { categoryChartDefaults } from '../shared/controls/activationDefaults.js';
import { BAR_CONTROLS } from '../bar/controls/descriptions.js';
import { SCATTER3D_CONTROLS } from '../scatter3d/controls/descriptions.js';
import { computeDefaults as computeScatter3dDefaults } from '../scatter3d/controls/activationDefaults.js';
import { BUBBLE_CONTROLS } from '../bubble/controls/descriptions.js';
import { LINE_CONTROLS } from '../line/controls/descriptions.js';
import { computeDefaults as computeLineDefaults } from '../line/controls/activationDefaults.js';
import { NETWORK_CONTROLS } from '../network/controls/descriptions.js';
import { computeDefaults as computeNetworkDefaults } from '../network/controls/activationDefaults.js';
import { createScatterPlotControls } from '../scatter/controls/builder.js';
import { setupScatterPlotControlListeners } from '../scatter/controls/listeners.js';
import { computeDefaults as computeScatterDefaults } from '../scatter/controls/activationDefaults.js';
import { PIE_CONTROLS } from '../pie/controls/descriptions.js';
import { TREEMAP_CONTROLS } from '../treemap/controls/descriptions.js';
import { TIN_CONTROLS } from '../tin/controls/descriptions.js';
import { computeDefaults as computeTinDefaults } from '../tin/controls/activationDefaults.js';

/** @type {Readonly<Object<ChartTypeKey, Readonly<ChartControlAdapter>>>} */
const CONTROL_ADAPTERS = Object.freeze({
	bar: Object.freeze({
		controls: BAR_CONTROLS,
		computeDefaults: categoryChartDefaults('bar'),
	}),
	line: Object.freeze({
		controls: LINE_CONTROLS,
		computeDefaults: computeLineDefaults,
	}),
	scatter: Object.freeze({
		build: (dataset, context) => createScatterPlotControls(
			dataset,
			context.numeric,
			context.allColumns,
		),
		attachListeners: (dataset, context, writer) => setupScatterPlotControlListeners(
			dataset,
			context.numeric,
			context.allColumns,
			writer,
		),
		computeDefaults: computeScatterDefaults,
	}),
	scatter3d: Object.freeze({
		controls: SCATTER3D_CONTROLS,
		computeDefaults: computeScatter3dDefaults,
	}),
	pie: Object.freeze({
		controls: PIE_CONTROLS,
		computeDefaults: categoryChartDefaults('pie'),
	}),
	bubble: Object.freeze({
		controls: BUBBLE_CONTROLS,
		computeDefaults: categoryChartDefaults('bubble'),
	}),
	network: Object.freeze({
		controls: NETWORK_CONTROLS,
		computeDefaults: computeNetworkDefaults,
	}),
	treemap: Object.freeze({
		controls: TREEMAP_CONTROLS,
		computeDefaults: categoryChartDefaults('treemap'),
	}),
	tin: Object.freeze({
		controls: TIN_CONTROLS,
		computeDefaults: computeTinDefaults,
	}),
});

/**
 * Chart types with controls adapters, in canonical chart order.
 *
 * @type {ReadonlyArray<ChartTypeKey>}
 */
export const SUPPORTED_CONTROL_CHART_TYPES = Object.freeze(
	CHART_TYPE_KEYS.filter(type => Object.hasOwn(CONTROL_ADAPTERS, type)),
);

/**
 * Resolve a chart controls adapter without exposing the mutable registry
 * implementation. Unknown keys return `null`.
 *
 * @param {string} chartType
 * @returns {Readonly<ChartControlAdapter> | null}
 */
export function getChartControlAdapter(chartType) {
	return Object.hasOwn(CONTROL_ADAPTERS, chartType)
		? CONTROL_ADAPTERS[chartType]
		: null;
}
