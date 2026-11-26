/**
 * SQLite schema and pure read/write helpers for CHIVE project persistence.
 *
 * This module intentionally knows nothing about IndexedDB, WASM loading, or UI
 * state events. Callers provide an initialized sqlite-wasm `db` handle.
 *
 * @typedef {import('../../../types.js').AppState} AppState
 */

import { CELL_FORMAT_VERSION } from '../../../domain/datasets/cellValues.js';
import { isStringLimitError, payloadTooLargeError } from '../errors.js';
import { mapPlacementPayloads, placementKey } from '../placementPayloads.js';

export const SQLITE_SCHEMA_VERSION = '2';
export const SQLITE_FORMAT = 'chive-project';

// Meta key for the generation of the stored cell format. Projects saved before
// cells were canonical have none, and readers that predate it ignore it.
const CELL_FORMAT_META_KEY = 'cell_format_version';

/**
 * Serialize rows, naming their owner when the text would exceed the engine's
 * maximum string length.
 *
 * @param {Array<Object>} rows
 * @param {{ kind: 'dataset' | 'chart', name: string }} owner
 * @returns {string}
 */
function stringifyRows(rows, owner) {
	try {
		return JSON.stringify(rows);
	} catch (error) {
		if (isStringLimitError(error)) throw payloadTooLargeError(owner);
		throw error;
	}
}

function jsonParse(raw, fallback) {
	if (typeof raw !== 'string') return fallback;
	try {
		return JSON.parse(raw);
	} catch {
		return fallback;
	}
}

function isNonArrayObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function bindExec(db, sql, bind = []) {
	db.exec({ sql, bind });
}

function selectRows(db, sql, bind = []) {
	const rows = [];
	db.exec({
		sql,
		bind,
		rowMode: 'object',
		callback: row => rows.push(row),
	});
	return rows;
}

function getFingerprintForDataset(dataset, fingerprintsByDatasetId) {
	const record = fingerprintsByDatasetId instanceof Map
		? fingerprintsByDatasetId.get(dataset.id)
		: fingerprintsByDatasetId?.[dataset.id];
	if (!record?.fingerprint || !record?.algorithm) {
		throw new Error(`Missing fingerprint for dataset ${dataset.id}`);
	}
	return record;
}

function buildPanelRecord(panel) {
	const source = isNonArrayObject(panel) ? panel : {};
	const snapshotPayloads = [];
	const placementPayloads = [];
	const charts = Array.isArray(source.charts)
		? source.charts.map(chart => {
			if (!isNonArrayObject(chart)) return chart;
			const { dataSnapshot, columnsSnapshot, ...chartDoc } = chart;
			const chartId = Number(chart.id);
			if (Number.isInteger(chartId)) {
				snapshotPayloads.push({
					chartId,
					name: typeof chart.name === 'string' ? chart.name : '',
					rows: Array.isArray(dataSnapshot) ? dataSnapshot : [],
					columns: Array.isArray(columnsSnapshot) ? columnsSnapshot : [],
				});
			}
			return chartDoc;
		})
		: [];

	const blocks = mapPlacementPayloads(source.blocks, (placement, blockId, slotId, chartId) => {
		const { dataSnapshot, columnsSnapshot, ...metadata } = placement;
		if (Array.isArray(dataSnapshot) && Array.isArray(columnsSnapshot)) {
			placementPayloads.push({
				blockId, slotId, rows: dataSnapshot, columns: columnsSnapshot,
				name: charts.find(chart => chart?.id === chartId)?.name || '',
			});
		}
		return metadata;
	});
	return {
		panelDoc: {
			blocks,
			charts,
			slots: isNonArrayObject(source.slots) ? source.slots : {},
			layout: typeof source.layout === 'string' ? source.layout : 'template-2col',
			nextBlockId: Number.isInteger(source.nextBlockId) ? source.nextBlockId : 1,
			nextChartId: Number.isInteger(source.nextChartId) ? source.nextChartId : 0,
		},
		snapshotPayloads,
		placementPayloads,
	};
}

function getActiveDatasetId(snapshot, datasets) {
	const activeIdx = Number.isInteger(snapshot?.data?.activeIndex)
		? snapshot.data.activeIndex
		: -1;
	return activeIdx >= 0 && activeIdx < datasets.length
		? datasets[activeIdx]?.id || null
		: null;
}

function readCellFormatVersion(db) {
	const [row] = selectRows(db, 'SELECT value FROM meta WHERE key = ?', [CELL_FORMAT_META_KEY]);
	const version = Number(row?.value);
	return Number.isInteger(version) && version > 0 ? version : null;
}

export function assertMeta(db, { requireMeta = false } = {}) {
	const rows = selectRows(db, 'SELECT key, value FROM meta');
	if (rows.length === 0) {
		if (requireMeta) throw new Error('Missing CHIVE SQLite project metadata');
		return;
	}
	const meta = Object.fromEntries(rows.map(row => [row.key, row.value]));
	if (requireMeta && (!Object.hasOwn(meta, 'format') || !Object.hasOwn(meta, 'schema_version'))) {
		throw new Error('Missing CHIVE SQLite project metadata');
	}
	if (Object.hasOwn(meta, 'format') && meta.format !== SQLITE_FORMAT) {
		throw new Error(`Unsupported CHIVE SQLite format: ${meta.format}`);
	}
	if (Object.hasOwn(meta, 'schema_version') && !['1', SQLITE_SCHEMA_VERSION].includes(meta.schema_version)) {
		throw new Error(`Unsupported CHIVE SQLite schema version: ${meta.schema_version}`);
	}
}

/**
 * Create the current project schema if it is not already present.
 *
 * @param {*} db sqlite-wasm oo1 DB instance
 */
export function applySchema(db) {
	db.exec(`
		CREATE TABLE IF NOT EXISTS meta (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS datasets (
			id TEXT PRIMARY KEY,
			position INTEGER NOT NULL,
			name TEXT NOT NULL,
			columns_json TEXT NOT NULL,
			selected_columns_json TEXT NOT NULL,
			chart_config_json TEXT NOT NULL,
			precomputed_stats_json TEXT,
			size_label TEXT,
			fingerprint TEXT NOT NULL,
			fingerprint_algorithm TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS app_state (
			key TEXT PRIMARY KEY,
			doc TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS dataset_payload (
			dataset_id TEXT PRIMARY KEY,
			rows_json TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS panel_snapshot_payload (
			chart_id INTEGER PRIMARY KEY,
			rows_json TEXT NOT NULL,
			columns_json TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS panel_placement_payload (
			block_id TEXT NOT NULL,
			slot_id TEXT NOT NULL,
			rows_json TEXT NOT NULL,
			columns_json TEXT NOT NULL,
			PRIMARY KEY (block_id, slot_id)
		);
	`);
}

/**
 * Replace all project content in the SQLite DB with `snapshot`. Its cells are
 * canonical, as every in-memory row is, so the current cell format is stamped.
 *
 * Rows too large for one string throw a `PayloadTooLargeError` naming the
 * dataset or saved chart, and the transaction rolls back.
 *
 * @param {*} db sqlite-wasm oo1 DB instance
 * @param {Partial<AppState>} snapshot
 * @param {{ fingerprintsByDatasetId: Map<string, { fingerprint: string, algorithm: string }> | Object<string, { fingerprint: string, algorithm: string }> }} options
 */
export function writeSnapshot(db, snapshot, { fingerprintsByDatasetId } = {}) {
	applySchema(db);
	const allDatasets = Array.isArray(snapshot?.data?.datasets)
		? snapshot.data.datasets
		: [];
	const activeDatasetId = getActiveDatasetId(snapshot, allDatasets);
	const datasets = allDatasets.filter(dataset => dataset?.id);
	const { panelDoc, snapshotPayloads, placementPayloads } = buildPanelRecord(snapshot?.panel);

	db.exec('BEGIN IMMEDIATE');
	try {
		db.exec('DELETE FROM meta');
		db.exec('DELETE FROM datasets');
		db.exec('DELETE FROM app_state');
		db.exec('DELETE FROM dataset_payload');
		db.exec('DELETE FROM panel_snapshot_payload');
		db.exec('DELETE FROM panel_placement_payload');

		bindExec(db, 'INSERT INTO meta(key, value) VALUES (?, ?)', ['format', SQLITE_FORMAT]);
		bindExec(db, 'INSERT INTO meta(key, value) VALUES (?, ?)', ['schema_version', SQLITE_SCHEMA_VERSION]);
		bindExec(db, 'INSERT INTO meta(key, value) VALUES (?, ?)', [CELL_FORMAT_META_KEY, String(CELL_FORMAT_VERSION)]);

		datasets.forEach((dataset, position) => {
			const fingerprint = getFingerprintForDataset(dataset, fingerprintsByDatasetId);
			bindExec(
				db,
				`INSERT INTO datasets(
					id, position, name, columns_json, selected_columns_json,
					chart_config_json, precomputed_stats_json, size_label,
					fingerprint, fingerprint_algorithm
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					dataset.id,
					position,
					typeof dataset.name === 'string' ? dataset.name : '',
					JSON.stringify(Array.isArray(dataset.columns) ? dataset.columns : []),
					JSON.stringify(Array.isArray(dataset.selectedColumns) ? dataset.selectedColumns : []),
					JSON.stringify(isNonArrayObject(dataset.chartConfig) ? dataset.chartConfig : {}),
					dataset.precomputedStats === undefined ? null : JSON.stringify(dataset.precomputedStats),
					typeof dataset.sizeLabel === 'string' ? dataset.sizeLabel : null,
					fingerprint.fingerprint,
					fingerprint.algorithm,
				],
			);
			bindExec(
				db,
				'INSERT INTO dataset_payload(dataset_id, rows_json) VALUES (?, ?)',
				[dataset.id, stringifyRows(Array.isArray(dataset.rows) ? dataset.rows : [], { kind: 'dataset', name: dataset.name })],
			);
		});

		bindExec(
			db,
			'INSERT INTO app_state(key, doc) VALUES (?, ?)',
			['data_state', JSON.stringify({ activeDatasetId })],
		);
		bindExec(
			db,
			'INSERT INTO app_state(key, doc) VALUES (?, ?)',
			['panel', JSON.stringify(panelDoc)],
		);

		snapshotPayloads.forEach(payload => {
			bindExec(
				db,
				'INSERT INTO panel_snapshot_payload(chart_id, rows_json, columns_json) VALUES (?, ?, ?)',
				[
					payload.chartId,
					stringifyRows(payload.rows, { kind: 'chart', name: payload.name }),
					JSON.stringify(payload.columns),
				],
			);
		});

		placementPayloads.forEach(payload => {
			bindExec(db,
				'INSERT INTO panel_placement_payload(block_id, slot_id, rows_json, columns_json) VALUES (?, ?, ?, ?)',
				[payload.blockId, payload.slotId, stringifyRows(payload.rows, { kind: 'chart', name: payload.name }), JSON.stringify(payload.columns)],
			);
		});
		db.exec('COMMIT');
	} catch (error) {
		try {
			db.exec('ROLLBACK');
		} catch {
			// Ignore rollback failures; the original write error is the useful one.
		}
		throw error;
	}
}

/**
 * Read a project snapshot from the SQLite DB.
 *
 * @param {*} db sqlite-wasm oo1 DB instance
 * @returns {{ cellFormatVersion: number | null, data: { datasets: Array<Object>, activeDatasetId: string | null }, panel: Object | null }} `cellFormatVersion` is `null` for projects saved before cells were canonical.
 */
export function readSnapshot(db) {
	applySchema(db);
	assertMeta(db);

	const payloadByDatasetId = new Map(
		selectRows(db, 'SELECT dataset_id, rows_json FROM dataset_payload')
			.map(row => [row.dataset_id, row.rows_json])
	);
	const datasets = selectRows(db, 'SELECT * FROM datasets ORDER BY position ASC, id ASC')
		.map(row => ({
			id: row.id,
			name: row.name,
			rows: payloadByDatasetId.has(row.id)
				? jsonParse(payloadByDatasetId.get(row.id), [])
				: null,
			columns: jsonParse(row.columns_json, []),
			selectedColumns: jsonParse(row.selected_columns_json, []),
			chartConfig: jsonParse(row.chart_config_json, {}),
			precomputedStats: row.precomputed_stats_json === null
				? undefined
				: jsonParse(row.precomputed_stats_json, undefined),
			sizeLabel: row.size_label || '',
			fingerprint: row.fingerprint,
			fingerprintAlgorithm: row.fingerprint_algorithm,
		}));

	const appStateRows = selectRows(db, 'SELECT key, doc FROM app_state');
	const appStateDocs = Object.fromEntries(appStateRows.map(row => [row.key, jsonParse(row.doc, null)]));
	const panelDoc = isNonArrayObject(appStateDocs.panel) ? appStateDocs.panel : null;
	const payloadByChartId = new Map(
		selectRows(db, 'SELECT chart_id, rows_json, columns_json FROM panel_snapshot_payload')
			.map(row => [Number(row.chart_id), {
				rows: jsonParse(row.rows_json, []),
				columns: jsonParse(row.columns_json, []),
			}])
	);

	const payloadByPlacement = new Map(selectRows(db, 'SELECT block_id, slot_id, rows_json, columns_json FROM panel_placement_payload')
		.map(row => [placementKey(row.block_id, row.slot_id), {
			dataSnapshot: jsonParse(row.rows_json, []), columnsSnapshot: jsonParse(row.columns_json, []),
		}]));
	const panel = panelDoc
		? {
			...panelDoc,
			blocks: mapPlacementPayloads(panelDoc.blocks, (placement, blockId, slotId) => ({
				...placement, ...payloadByPlacement.get(placementKey(blockId, slotId)),
			})),
			charts: Array.isArray(panelDoc.charts)
				? panelDoc.charts.map(chart => {
					const payload = payloadByChartId.get(Number(chart?.id));
					return {
						...chart,
						dataSnapshot: payload ? payload.rows : [],
						columnsSnapshot: payload ? payload.columns : [],
					};
				})
				: [],
		}
		: null;

	const dataState = isNonArrayObject(appStateDocs.data_state) ? appStateDocs.data_state : {};
	return {
		cellFormatVersion: readCellFormatVersion(db),
		data: {
			datasets,
			activeDatasetId: dataState.activeDatasetId || null,
		},
		panel,
	};
}
