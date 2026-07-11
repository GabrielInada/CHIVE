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
 * @typedef {{
 *   build: (dataset: Dataset, context: ChartControlContext) => HTMLElement[],
 *   attachListeners: (dataset: Dataset, context: ChartControlContext, onConfigChanged: (() => void) | null) => void,
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
import {
	createBubbleChartControls,
	setupBubbleChartControlListeners,
	computeDefaults as computeBubbleDefaults,
} from '../../modules/chartControls/bubbleControls.js';
import {
	createLineChartControls,
	setupLineChartControlListeners,
	computeDefaults as computeLineDefaults,
} from '../../modules/chartControls/lineControls.js';
import {
	createNetworkGraphControls,
	setupNetworkGraphControlListeners,
	computeDefaults as computeNetworkDefaults,
} from '../../modules/chartControls/networkControls.js';
import {
	createScatterPlotControls,
	setupScatterPlotControlListeners,
	computeDefaults as computeScatterDefaults,
} from '../../modules/chartControls/scatterControls.js';
import { createPieChartControls } from '../pie/controls/builder.js';
import { setupPieChartControlListeners } from '../pie/controls/listeners.js';
import { computeDefaults as computePieDefaults } from '../pie/controls/defaults.js';
import { createTreeMapControls } from '../treemap/controls/builder.js';
import { setupTreeMapControlListeners } from '../treemap/controls/listeners.js';
import { computeDefaults as computeTreemapDefaults } from '../treemap/controls/defaults.js';
import {
	createTinControls,
	setupTinControlListeners,
	computeDefaults as computeTinDefaults,
} from '../../modules/chartControls/tinControls.js';

/** @type {Readonly<Object<ChartTypeKey, Readonly<ChartControlAdapter>>>} */
const CONTROL_ADAPTERS = Object.freeze({
	bar: Object.freeze({
		build: (dataset, context) => createBarChartControls(
			dataset,
			context.baseCategoricalOrAll,
			context.numeric,
			context.allColumns,
		),
		attachListeners: (dataset, context, callback) => setupBarChartControlListeners(
			dataset,
			context.baseCategoricalOrAll,
			context.numeric,
			context.allColumns,
			callback,
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
		attachListeners: (dataset, context, callback) => setupLineChartControlListeners(
			dataset,
			context.numeric,
			context.dates,
			context.allColumns,
			callback,
		),
		computeDefaults: computeLineDefaults,
	}),
	scatter: Object.freeze({
		build: (dataset, context) => createScatterPlotControls(
			dataset,
			context.numeric,
			context.allColumns,
		),
		attachListeners: (dataset, context, callback) => setupScatterPlotControlListeners(
			dataset,
			context.numeric,
			context.allColumns,
			callback,
		),
		computeDefaults: computeScatterDefaults,
	}),
	scatter3d: Object.freeze({
		build: (dataset, context) => createScatter3dControls(
			dataset,
			context.numeric,
			context.allColumns,
		),
		attachListeners: (dataset, context, callback) => setupScatter3dControlListeners(
			dataset,
			context.numeric,
			context.allColumns,
			callback,
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
		attachListeners: (dataset, context, callback) => setupPieChartControlListeners(
			dataset,
			context.baseCategoricalOrAll,
			context.numeric,
			context.allColumns,
			callback,
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
		attachListeners: (dataset, context, callback) => setupBubbleChartControlListeners(
			dataset,
			context.baseCategoricalOrAll,
			context.numeric,
			context.allColumns,
			callback,
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
		attachListeners: (dataset, context, callback) => setupNetworkGraphControlListeners(
			dataset,
			context.allColumns,
			context.numeric,
			callback,
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
		attachListeners: (dataset, context, callback) => setupTreeMapControlListeners(
			dataset,
			context.baseCategoricalOrAll,
			context.numeric,
			context.allColumns,
			callback,
		),
		computeDefaults: computeTreemapDefaults,
	}),
	tin: Object.freeze({
		build: (dataset, context) => createTinControls(
			dataset,
			context.numeric,
			context.allColumns,
		),
		attachListeners: (dataset, context, callback) => setupTinControlListeners(
			dataset,
			context.numeric,
			context.allColumns,
			callback,
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
