/**
 * Chart controls integration registry.
 *
 * Each entry adapts one chart's controls package to the shared manager
 * contract. This registry owns controls wiring only; it does not import
 * workspace renderers, panel adapters, state, or services.
 *
 * @typedef {import('../../types.js').ChartTypeKey} ChartTypeKey
 * @typedef {import('../../types.js').Dataset} Dataset
 * @typedef {import('../../types.js').ChartControlContext} ChartControlContext
 * @typedef {import('../../types.js').ChartConfigWriter} ChartConfigWriter
 * @typedef {{
 *   build: (dataset: Dataset, context: ChartControlContext) => HTMLElement[],
 *   attachListeners: (dataset: Dataset, context: ChartControlContext, writer: ChartConfigWriter) => void,
 *   computeDefaults: (dataset: Dataset, context: ChartControlContext) => Object
 * }} ChartControlAdapter
 */

import { CHART_TYPE_KEYS } from '../../config/chartTypes.js';
import { createBarChartControls } from '../bar/controls/builder.js';
import { setupBarChartControlListeners } from '../bar/controls/listeners.js';
import { computeDefaults as computeBarDefaults } from '../bar/controls/defaults.js';
import { createScatter3dControls } from '../scatter3d/controls/builder.js';
import { setupScatter3dControlListeners } from '../scatter3d/controls/listeners.js';
import { computeDefaults as computeScatter3dDefaults } from '../scatter3d/controls/defaults.js';
import { createBubbleChartControls } from '../bubble/controls/builder.js';
import { setupBubbleChartControlListeners } from '../bubble/controls/listeners.js';
import { computeDefaults as computeBubbleDefaults } from '../bubble/controls/defaults.js';
import { createLineChartControls } from '../line/controls/builder.js';
import { setupLineChartControlListeners } from '../line/controls/listeners.js';
import { computeDefaults as computeLineDefaults } from '../line/controls/defaults.js';
import { createNetworkGraphControls } from '../network/controls/builder.js';
import { setupNetworkGraphControlListeners } from '../network/controls/listeners.js';
import { computeDefaults as computeNetworkDefaults } from '../network/controls/defaults.js';
import { createScatterPlotControls } from '../scatter/controls/builder.js';
import { setupScatterPlotControlListeners } from '../scatter/controls/listeners.js';
import { computeDefaults as computeScatterDefaults } from '../scatter/controls/defaults.js';
import { createPieChartControls } from '../pie/controls/builder.js';
import { setupPieChartControlListeners } from '../pie/controls/listeners.js';
import { computeDefaults as computePieDefaults } from '../pie/controls/defaults.js';
import { createTreeMapControls } from '../treemap/controls/builder.js';
import { setupTreeMapControlListeners } from '../treemap/controls/listeners.js';
import { computeDefaults as computeTreemapDefaults } from '../treemap/controls/defaults.js';
import { createTinControls } from '../tin/controls/builder.js';
import { setupTinControlListeners } from '../tin/controls/listeners.js';
import { computeDefaults as computeTinDefaults } from '../tin/controls/defaults.js';

/** @type {Readonly<Object<ChartTypeKey, Readonly<ChartControlAdapter>>>} */
const CONTROL_ADAPTERS = Object.freeze({
	bar: Object.freeze({
		build: (dataset, context) => createBarChartControls(
			dataset,
			context.baseCategoricalOrAll,
			context.numeric,
			context.allColumns,
		),
		attachListeners: (dataset, context, writer) => setupBarChartControlListeners(
			dataset,
			context.baseCategoricalOrAll,
			context.numeric,
			context.allColumns,
			writer,
		),
		computeDefaults: computeBarDefaults,
	}),
	line: Object.freeze({
		build: (dataset, context) => createLineChartControls(
			dataset,
			context.numeric,
			context.dates,
			context.allColumns,
		),
		attachListeners: (dataset, context, writer) => setupLineChartControlListeners(
			dataset,
			context.numeric,
			context.dates,
			context.allColumns,
			writer,
		),
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
		build: (dataset, context) => createScatter3dControls(
			dataset,
			context.numeric,
			context.allColumns,
		),
		attachListeners: (dataset, context, writer) => setupScatter3dControlListeners(
			dataset,
			context.numeric,
			context.allColumns,
			writer,
		),
		computeDefaults: computeScatter3dDefaults,
	}),
	pie: Object.freeze({
		build: (dataset, context) => createPieChartControls(
			dataset,
			context.baseCategoricalOrAll,
			context.numeric,
			context.allColumns,
		),
		attachListeners: (dataset, context, writer) => setupPieChartControlListeners(
			dataset,
			context.baseCategoricalOrAll,
			context.numeric,
			context.allColumns,
			writer,
		),
		computeDefaults: computePieDefaults,
	}),
	bubble: Object.freeze({
		build: (dataset, context) => createBubbleChartControls(
			dataset,
			context.baseCategoricalOrAll,
			context.numeric,
			context.allColumns,
		),
		attachListeners: (dataset, context, writer) => setupBubbleChartControlListeners(
			dataset,
			context.baseCategoricalOrAll,
			context.numeric,
			context.allColumns,
			writer,
		),
		computeDefaults: computeBubbleDefaults,
	}),
	network: Object.freeze({
		build: (dataset, context) => createNetworkGraphControls(
			dataset,
			context.allColumns,
			context.numeric,
			context.categorical,
		),
		attachListeners: (dataset, context, writer) => setupNetworkGraphControlListeners(
			dataset,
			context.allColumns,
			context.numeric,
			writer,
		),
		computeDefaults: computeNetworkDefaults,
	}),
	treemap: Object.freeze({
		build: (dataset, context) => createTreeMapControls(
			dataset,
			context.baseCategoricalOrAll,
			context.numeric,
			context.allColumns,
		),
		attachListeners: (dataset, context, writer) => setupTreeMapControlListeners(
			dataset,
			context.baseCategoricalOrAll,
			context.numeric,
			context.allColumns,
			writer,
		),
		computeDefaults: computeTreemapDefaults,
	}),
	tin: Object.freeze({
		build: (dataset, context) => createTinControls(
			dataset,
			context.numeric,
			context.allColumns,
		),
		attachListeners: (dataset, context, writer) => setupTinControlListeners(
			dataset,
			context.numeric,
			context.allColumns,
			writer,
		),
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
