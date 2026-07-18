import { STATE_EVENTS } from './stateEvents.js';
import { canonicalizeChartConfig } from '../config/chartDefaults.js';
import { CHART_TYPE_KEYS } from '../config/chartTypes.js';
import { getDatasetColumnNames } from '../domain/datasets/columns.js';

/**
 * CHIVE data-domain facade.
 *
 * Owns every write into `appState.data`. The exports in `appState.js` are
 * thin wrappers around the methods returned here, call those, not these,
 * from outside this module. Direct mutation of dataset fields or of the
 * datasets array is forbidden; ESLint enforces it for the renderer layer.
 *
 * @typedef {import('../types.js').Dataset} Dataset
 * @typedef {import('../types.js').ChartTypeKey} ChartTypeKey
 *
 * @see docs/development/architecture.md
 * @see CONTRIBUTING.md "Architecture invariants, do not break"
 */

let datasetIdCounter = 0;

/**
 * @private
 * @param {*} value
 * @returns {boolean}
 */
function isPlainObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Produce a stable dataset id. Uses `crypto.randomUUID` when available;
 * falls back to `dataset-<timestamp>-<n>` in environments without crypto
 * (notably some Vitest configurations).
 *
 * @private
 * @returns {string}
 */
function generateDatasetId() {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	datasetIdCounter += 1;
	return `dataset-${Date.now()}-${datasetIdCounter}`;
}

/**
 * Build the data-domain facade. Invoked once from `appState.js` with the
 * private state object and the emit hook; the returned methods are the only
 * sanctioned way to mutate the data domain.
 *
 * @param {Object} deps
 * @param {import('../types.js').AppState} deps.appState - Private mutable state object owned by `appState.js`.
 * @param {(eventType: import('../types.js').StateEventType, data?: *) => void} deps.emitStateChange
 * @returns {{
 *   getActiveDataset: () => (Dataset | null),
 *   getActiveDatasetIndex: () => number,
 *   getAllDatasets: () => Dataset[],
 *   setActiveDataset: (index: number) => void,
 *   addDataset: (dataset: Dataset) => number,
 *   removeDataset: (index: number) => void,
 *   updateActiveDatasetConfig: (updates: Object) => void,
 *   updateActiveDatasetColumns: (columnNames: string[]) => void,
 *   normalizeActiveDatasetConfig: (normalizer: (config: Object) => Object) => void,
 *   setActiveChartType: (chartType: (ChartTypeKey | null), activatedOverrides?: (Object | null)) => void,
 * }}
 */
export function createDataStateFacade({ appState, emitStateChange }) {
	/**
	 * @returns {Dataset | null} Live reference to the active dataset, or `null` when none is selected. Do not mutate.
	 */
	function getActiveDataset() {
		if (appState.data.activeIndex === -1 || !appState.data.datasets[appState.data.activeIndex]) {
			return null;
		}
		return appState.data.datasets[appState.data.activeIndex];
	}

	/**
	 * @returns {number} Active dataset index, or `-1` when none is selected.
	 */
	function getActiveDatasetIndex() {
		return appState.data.activeIndex;
	}

	/**
	 * @returns {Dataset[]} Live reference to the datasets array. Do not mutate.
	 */
	function getAllDatasets() {
		return appState.data.datasets;
	}

	/**
	 * Switch the active dataset.
	 *
	 * @param {number} index - Zero-based index into the datasets array, or `-1` to deselect.
	 * @throws {Error} When `index < -1` or `index >= datasets.length`.
	 * @fires STATE_EVENTS.ACTIVE_DATASET
	 */
	function setActiveDataset(index) {
		if (index < -1 || index >= appState.data.datasets.length) {
			throw new Error(`Invalid dataset index: ${index}`);
		}
		appState.data.activeIndex = index;
		emitStateChange(STATE_EVENTS.ACTIVE_DATASET, index);
	}

	/**
	 * Append a dataset. If `dataset.id` is missing, a stable id is stamped
	 * in place so persistence can address the dataset across reloads. The
	 * `chartConfig` is canonicalized in place (default-filled, legacy-migrated,
	 * stale filters trimmed) before the emit, so callers pushing a partial config
	 * still land canonical state and DATASET_ADDED carries the stored dataset. When
	 * no dataset is currently active, the new one is auto-activated.
	 *
	 * @param {Dataset} dataset - Must have a `rows` array.
	 * @returns {number} Index of the newly added dataset.
	 * @throws {Error} When `dataset` is missing or `dataset.rows` is not an array.
	 * @fires STATE_EVENTS.DATASET_ADDED
	 */
	function addDataset(dataset) {
		if (!dataset || !Array.isArray(dataset.rows)) {
			throw new Error('Invalid dataset: must have "rows" array');
		}
		if (!dataset.id) {
			dataset.id = generateDatasetId();
		}
		dataset.chartConfig = canonicalizeChartConfig(dataset.chartConfig, getDatasetColumnNames(dataset));
		appState.data.datasets.push(dataset);
		const index = appState.data.datasets.length - 1;
		if (appState.data.activeIndex === -1) {
			appState.data.activeIndex = index;
		}
		emitStateChange(STATE_EVENTS.DATASET_ADDED, { index, dataset });
		return index;
	}

	/**
	 * Remove a dataset. **Cascading side effect:** also clears every panel
	 * snapshot (`panel.charts`) and the legacy slot map (`panel.slots`),
	 * because snapshots can reference columns and rows that no longer exist
	 * after removal. The active index is shifted back by one when needed.
	 *
	 * @param {number} index
	 * @throws {Error} When `index` is out of range.
	 * @fires STATE_EVENTS.DATASET_REMOVED
	 */
	function removeDataset(index) {
		if (index < 0 || index >= appState.data.datasets.length) {
			throw new Error(`Invalid dataset index: ${index}`);
		}
		appState.data.datasets.splice(index, 1);

		if (appState.data.activeIndex >= index) {
			appState.data.activeIndex = Math.max(-1, appState.data.activeIndex - 1);
		}

		// Clear panel snapshots tied to removed dataset context.
		appState.panel.charts = [];
		appState.panel.slots = {};

		emitStateChange(STATE_EVENTS.DATASET_REMOVED, index);
	}

	/**
	 * Shallow-merge `updates` into the active dataset's `chartConfig`, then
	 * canonicalize the result (default-filled, stale filters trimmed against the
	 * dataset's columns). The shallow-merge contract is unchanged: a partial chart
	 * block still replaces the whole block, and canonicalization only refills
	 * defaults, it does not restore previously-set custom fields. The emitted
	 * payload stays the raw `updates` (a routing hint), even when canonicalization
	 * changes state beyond the patch (e.g. trimming a stale filter). No-op when no
	 * dataset is active.
	 *
	 * @param {Object} updates - Partial `ChartConfig`-shaped patch.
	 * @fires STATE_EVENTS.CONFIG_UPDATED
	 */
	function updateActiveDatasetConfig(updates) {
		const dataset = getActiveDataset();
		if (!dataset) return;
		const columnNames = getDatasetColumnNames(dataset);
		const current = canonicalizeChartConfig(dataset.chartConfig, columnNames);
		const patch = isPlainObject(updates) ? updates : {};

		dataset.chartConfig = canonicalizeChartConfig(
			{ ...current, ...patch },
			columnNames,
		);
		emitStateChange(STATE_EVENTS.CONFIG_UPDATED, updates);
	}

	/**
	 * Replace the active dataset's selected-column list. No-op when no
	 * dataset is active.
	 *
	 * @param {string[]} columnNames - Subset of the dataset's `columns[].name` values.
	 * @fires STATE_EVENTS.COLUMNS_UPDATED
	 */
	function updateActiveDatasetColumns(columnNames) {
		const dataset = getActiveDataset();
		if (!dataset) return;

		dataset.selectedColumns = columnNames;
		emitStateChange(STATE_EVENTS.COLUMNS_UPDATED, columnNames);
	}

	/**
	 * Apply `normalizer` to `chartConfig` **without emitting**. Config is
	 * canonicalized at the state boundaries (persistence restore, `addDataset`, and
	 * the emitting config writes) via `canonicalizeChartConfig`; this escape hatch
	 * exists for the intentional non-emitting live-preview writes (color picker,
	 * chart-height drag). Emitting here would re-enter the render coordinator's
	 * `refreshView` via the CONFIG_UPDATED subscription and loop indefinitely.
	 *
	 * **Do not** add an emit to this function. If you need an emit, use
	 * {@link updateActiveDatasetConfig} instead.
	 *
	 * @param {(config: Object) => Object} normalizer - Receives the current `chartConfig`; returns the replacement.
	 */
	function normalizeActiveDatasetConfig(normalizer) {
		const dataset = getActiveDataset();
		if (!dataset) return;
		dataset.chartConfig = normalizer(dataset.chartConfig);
	}

	/**
	 * Radio-style chart-type activation: enable exactly one chart type (or
	 * none if `null`). Backs the single-chart-at-a-time viz tab UX.
	 *
	 * The optional `activatedOverrides` are merged into the activated chart's
	 * config in the same mutation, so per-chart toggle handlers can pass
	 * defaults (e.g. an initial category) without firing a second event.
	 *
	 * No-op when no dataset is active, or when `chartType` is non-null and
	 * not a recognized chart-type key.
	 *
	 * @param {ChartTypeKey | null} chartType - Type to activate, or `null` to disable all.
	 * @param {Object | null} [activatedOverrides] - Fields merged into the activated chart's config. Ignored when `chartType` is `null`.
	 * @fires STATE_EVENTS.CONFIG_UPDATED - Single emit per call, regardless of overrides.
	 */
	function setActiveChartType(chartType, activatedOverrides = null) {
		const dataset = getActiveDataset();
		if (!dataset) return;
		if (chartType !== null && !CHART_TYPE_KEYS.includes(chartType)) return;

		const columnNames = getDatasetColumnNames(dataset);
		const current = canonicalizeChartConfig(dataset.chartConfig, columnNames);
		const next = { ...current };
		CHART_TYPE_KEYS.forEach(type => {
			const previous = isPlainObject(current[type]) ? current[type] : {};
			next[type] = { ...previous, enabled: type === chartType };
		});
		if (chartType && isPlainObject(activatedOverrides)) {
			next[chartType] = { ...next[chartType], ...activatedOverrides };
		}
		dataset.chartConfig = canonicalizeChartConfig(next, columnNames);
		emitStateChange(STATE_EVENTS.CONFIG_UPDATED, { activeChartType: chartType });
	}

	return {
		getActiveDataset,
		getActiveDatasetIndex,
		getAllDatasets,
		setActiveDataset,
		addDataset,
		removeDataset,
		updateActiveDatasetConfig,
		updateActiveDatasetColumns,
		normalizeActiveDatasetConfig,
		setActiveChartType,
	};
}
