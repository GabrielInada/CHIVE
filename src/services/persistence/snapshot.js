/**
 * Stored-snapshot validation and normalization.
 *
 * Turns a raw backend snapshot into the shape appState expects: drops
 * untrustworthy dataset/chart records, resolves the active index, and runs the
 * caller-supplied `transformPanel`. Not side-effect-free: it invokes that
 * callback and emits `console.warn` when it discards malformed records.
 * Internal to the services/persistence.js facade.
 */

import { normalizeColumnNameList } from '../../domain/datasets/columns.js';
import { BUBBLE_CHART } from '../../config/charts.js';
import { canonicalizeChartConfig } from '../../domain/charts/chartConfig.js';

/**
 * @internal
 * @param {*} value
 * @returns {boolean}
 */
export function isPlainObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Bound the bubble chart's nesting depth at hydrate/import, the only place with
// declared-column context. An attacker-/corruption-controlled persisted config
// could carry an unbounded `nestingColumns`, which feeds quadratic control and
// renderer work; clamp it to declared, non-category columns capped at the shared
// maximum, and keep the legacy `groupColumn` pointer coherent with the head.
function sanitizeBubbleConfig(bubbleConfig, declaredColumnNames) {
	const allowed = new Set(
		normalizeColumnNameList(declaredColumnNames, { max: Infinity }).filter(name => name !== bubbleConfig.category),
	);
	const normalizedNesting = normalizeColumnNameList(
		bubbleConfig.nestingColumns,
		{ allowed, max: BUBBLE_CHART.maxNestingDepth },
	);
	const validLegacyGroup = normalizeColumnNameList([bubbleConfig.groupColumn], { allowed, max: 1 })[0] || null;
	return {
		...bubbleConfig,
		nestingColumns: normalizedNesting,
		groupColumn: normalizedNesting.length ? normalizedNesting[0] : validLegacyGroup,
	};
}

// Drop chart-spec entries that aren't plain objects; renderers read sub-keys
// and would explode on a string/number/array. The bubble block is additionally
// depth-bounded against the record's declared columns. validateDatasetRecord then
// runs canonicalizeChartConfig on the result to fill defaults and trim stale
// global-filter rules, so restored configs are canonical before render.
function sanitizeChartConfig(chartConfig, declaredColumnNames) {
	if (!isPlainObject(chartConfig)) return {};
	const sanitized = {};
	for (const [chartKey, chartTypeConfig] of Object.entries(chartConfig)) {
		if (isPlainObject(chartTypeConfig)) {
			sanitized[chartKey] = chartKey === 'bubble'
				? sanitizeBubbleConfig(chartTypeConfig, declaredColumnNames)
				: chartTypeConfig;
		}
	}
	return sanitized;
}

// Drop records the renderers can't trust. Returns a sanitized copy or null
// when the record is unrecoverable.
function validateDatasetRecord(record) {
	if (!isPlainObject(record)) return null;
	if (!record.id) return null;
	if (typeof record.name !== 'string') return null;
	if (!Array.isArray(record.rows)) return null;
	if (!Array.isArray(record.columns)) return null;
	const columnsOk = record.columns.every(
		column => isPlainObject(column) && typeof column.name === 'string' && typeof column.type === 'string'
	);
	if (!columnsOk) return null;
	const declaredColumnNames = record.columns.map(column => column.name);
	const sanitizedChartConfig = sanitizeChartConfig(record.chartConfig, declaredColumnNames);
	return {
		...record,
		selectedColumns: Array.isArray(record.selectedColumns) ? record.selectedColumns : [],
		chartConfig: canonicalizeChartConfig(sanitizedChartConfig, declaredColumnNames),
	};
}

function normalizePanel(panelRecord, transformPanel) {
	if (!panelRecord) return null;
	if (!isPlainObject(panelRecord)) return null;
	let panel = { ...panelRecord };
	delete panel.key;
	delete panel.activeDatasetId;
	if (typeof transformPanel === 'function') {
		try {
			panel = transformPanel(panel) || panel;
		} catch (err) {
			console.warn('[chive:persist] transformPanel failed; using raw record:', err);
		}
	}
	return panel;
}

/**
 * @internal
 * @param {Object | null | undefined} storedSnapshot
 * @param {{ transformPanel?: (panel: Object) => Object }} [options]
 * @returns {{ data: { datasets: Array, activeIndex: number }, panel: Object | null }}
 */
export function normalizeStoredSnapshot(storedSnapshot, { transformPanel } = {}) {
	const rawDatasets = Array.isArray(storedSnapshot?.data?.datasets)
		? storedSnapshot.data.datasets
		: [];
	const rawCount = rawDatasets.length;
	const datasets = rawDatasets.map(validateDatasetRecord).filter(Boolean);
	if (datasets.length < rawCount) {
		console.warn(`[chive:persist] dropped ${rawCount - datasets.length} malformed dataset record(s) at hydrate`);
	}

	const activeId = storedSnapshot?.data?.activeDatasetId || null;
	const activeIndex = activeId
		? datasets.findIndex(dataset => dataset.id === activeId)
		: -1;

	return {
		data: {
			datasets,
			activeIndex,
		},
		panel: normalizePanel(storedSnapshot?.panel, transformPanel),
	};
}

/**
 * @internal
 * @param {Object} snapshot
 * @param {Object | null} ui
 * @returns {boolean}
 */
export function hasHydratableState(snapshot, ui) {
	return Boolean(
		snapshot?.data?.datasets?.length
		|| snapshot?.panel
		|| ui
	);
}

/**
 * @internal
 * @param {Object} storedSnapshot
 * @returns {boolean}
 */
export function hasWorkOnlyDatasets(storedSnapshot) {
	const rawDatasets = Array.isArray(storedSnapshot?.data?.datasets)
		? storedSnapshot.data.datasets
		: [];
	return rawDatasets.some(dataset => dataset && dataset.rows === null);
}

/**
 * @internal
 * @returns {Object} A fresh empty panel snapshot.
 */
export function createEmptyPanelSnapshot() {
	return {
		charts: [],
		slots: {},
		layout: 'template-2col',
		blocks: [],
		nextBlockId: 1,
		nextChartId: 0,
	};
}
