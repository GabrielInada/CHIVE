/**
 * Stored-snapshot validation and normalization.
 *
 * Turns a raw backend snapshot into the shape appState expects: drops
 * untrustworthy dataset records, sanitizes their selected columns and chart
 * config, canonicalizes the cells of their rows and of panel captures,
 * resolves the active index, normalizes the panel envelope, and runs the
 * caller-supplied `transformPanel`. Panel chart/block records are not
 * generally validated here. Not side-effect-free: it invokes that callback and
 * emits `console.warn` when it discards malformed dataset records.
 * Internal to the services/persistence.js facade.
 */

import { normalizeColumnNameList } from '../../domain/datasets/columns.js';
import { canonicalizeRows } from '../../domain/datasets/cellValues.js';
import { BUBBLE_CHART } from '../../config/charts/definitions/bubble.js';
import { STATS_CATEGORICAL_VERSION, STATS_NUMERIC_VERSION } from '../../config/statistics.js';
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

// Cached stats are only trustworthy when they were produced by the current
// statistics implementation. An older numeric blob may carry a string `min` or
// a zero-skewed `mean` from when blank cells were counted, and an older
// categorical blob keyed dates by text the canonical cells no longer match.
// Drop each stale part and let statsView recompute it.
function withValidStats(precomputedStats) {
	if (!isPlainObject(precomputedStats)) return precomputedStats;
	const numericValid = precomputedStats.numericVersion === STATS_NUMERIC_VERSION;
	const categoricalValid = precomputedStats.categoricalVersion === STATS_CATEGORICAL_VERSION;
	if (numericValid && categoricalValid) return precomputedStats;
	const kept = { ...precomputedStats };
	if (!numericValid) delete kept.numeric;
	if (!categoricalValid) delete kept.categorical;
	return kept;
}

// Drop records the renderers can't trust. Returns a sanitized copy with
// canonical rows, or null when the record is unrecoverable.
function validateDatasetRecord(record, formatVersion) {
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
	const validated = {
		...record,
		rows: canonicalizeRows(record.rows, record.columns, { formatVersion }),
		selectedColumns: normalizeColumnNameList(record.selectedColumns, {
			allowed: new Set(declaredColumnNames),
			max: Infinity,
		}),
		chartConfig: canonicalizeChartConfig(sanitizedChartConfig, declaredColumnNames),
	};
	// Assign in place rather than in the literal, so a record without the key
	// does not gain an explicit `precomputedStats: undefined`.
	if ('precomputedStats' in validated) {
		validated.precomputedStats = withValidStats(validated.precomputedStats);
	}
	return validated;
}

// A panel capture holds dataset rows, so its cells are canonicalized like a
// dataset's. This runs here rather than in transformPanel because the legacy
// IndexedDB import passes none.
function withCanonicalCapture(chart, formatVersion) {
	if (!isPlainObject(chart) || !Array.isArray(chart.dataSnapshot) || !Array.isArray(chart.columnsSnapshot)) {
		return chart;
	}
	const columns = chart.columnsSnapshot.filter(
		column => isPlainObject(column) && typeof column.name === 'string' && typeof column.type === 'string'
	);
	const dataSnapshot = canonicalizeRows(chart.dataSnapshot, columns, { formatVersion });
	return dataSnapshot === chart.dataSnapshot ? chart : { ...chart, dataSnapshot };
}

function normalizePanel(panelRecord, transformPanel, formatVersion) {
	if (!panelRecord) return null;
	if (!isPlainObject(panelRecord)) return null;
	let panel = { ...panelRecord };
	delete panel.key;
	delete panel.activeDatasetId;
	if (Array.isArray(panel.charts)) {
		panel.charts = panel.charts.map(chart => withCanonicalCapture(chart, formatVersion));
	}
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
 * @param {Object | null | undefined} storedSnapshot - A backend read. Its `cellFormatVersion` is absent or `null` when the cells predate canonical cells.
 * @param {{ transformPanel?: (panel: Object) => Object }} [options]
 * @returns {{ data: { datasets: Array, activeIndex: number }, panel: Object | null }}
 */
export function normalizeStoredSnapshot(storedSnapshot, { transformPanel } = {}) {
	const formatVersion = storedSnapshot?.cellFormatVersion;
	const rawDatasets = Array.isArray(storedSnapshot?.data?.datasets)
		? storedSnapshot.data.datasets
		: [];
	const rawCount = rawDatasets.length;
	const datasets = rawDatasets.map(record => validateDatasetRecord(record, formatVersion)).filter(Boolean);
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
		panel: normalizePanel(storedSnapshot?.panel, transformPanel, formatVersion),
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
