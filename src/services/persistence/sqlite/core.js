/**
 * SQLite schema and pure read/write helpers for CHIVE project persistence.
 *
 * This module intentionally knows nothing about IndexedDB, WASM loading, or UI
 * state events. Callers provide an initialized sqlite-wasm `db` handle.
 *
 * @typedef {import('../../../types.js').AppState} AppState
 */

export const SQLITE_SCHEMA_VERSION = '1';
export const SQLITE_FORMAT = 'chive-project';

function jsonStringify(value, fallback) {
	return JSON.stringify(value === undefined ? fallback : value);
}

function jsonParse(raw, fallback) {
	if (typeof raw !== 'string') return fallback;
	try {
		return JSON.parse(raw);
	} catch {
		return fallback;
	}
}

function isPlainObject(value) {
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
	const source = isPlainObject(panel) ? panel : {};
	const snapshotPayloads = [];
	const charts = Array.isArray(source.charts)
		? source.charts.map(chart => {
			if (!isPlainObject(chart)) return chart;
			const { dataSnapshot, columnsSnapshot, ...chartDoc } = chart;
			const chartId = Number(chart.id);
			if (Number.isInteger(chartId)) {
				snapshotPayloads.push({
					chartId,
					rows: Array.isArray(dataSnapshot) ? dataSnapshot : [],
					columns: Array.isArray(columnsSnapshot) ? columnsSnapshot : [],
				});
			}
			return chartDoc;
		})
		: [];

	return {
		panelDoc: {
			blocks: Array.isArray(source.blocks) ? source.blocks : [],
			charts,
			slots: isPlainObject(source.slots) ? source.slots : {},
			layout: typeof source.layout === 'string' ? source.layout : 'template-2col',
			nextBlockId: Number.isInteger(source.nextBlockId) ? source.nextBlockId : 1,
			nextChartId: Number.isInteger(source.nextChartId) ? source.nextChartId : 0,
		},
		snapshotPayloads,
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

export function assertMeta(db, { requireMeta = false } = {}) {
	const rows = selectRows(db, 'SELECT key, value FROM meta');
	if (rows.length === 0) {
		if (requireMeta) throw new Error('Missing CHIVE SQLite project metadata');
		return;
	}
	const meta = Object.fromEntries(rows.map(row => [row.key, row.value]));
	if (meta.format && meta.format !== SQLITE_FORMAT) {
		throw new Error(`Unsupported CHIVE SQLite format: ${meta.format}`);
	}
	if (meta.schema_version && meta.schema_version !== SQLITE_SCHEMA_VERSION) {
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
	`);
}

/**
 * Replace all project content in the SQLite DB with `snapshot`.
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
	const { panelDoc, snapshotPayloads } = buildPanelRecord(snapshot?.panel);

	db.exec('BEGIN IMMEDIATE');
	try {
		db.exec('DELETE FROM meta');
		db.exec('DELETE FROM datasets');
		db.exec('DELETE FROM app_state');
		db.exec('DELETE FROM dataset_payload');
		db.exec('DELETE FROM panel_snapshot_payload');

		bindExec(db, 'INSERT INTO meta(key, value) VALUES (?, ?)', ['format', SQLITE_FORMAT]);
		bindExec(db, 'INSERT INTO meta(key, value) VALUES (?, ?)', ['schema_version', SQLITE_SCHEMA_VERSION]);

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
					jsonStringify(Array.isArray(dataset.columns) ? dataset.columns : [], []),
					jsonStringify(Array.isArray(dataset.selectedColumns) ? dataset.selectedColumns : [], []),
					jsonStringify(isPlainObject(dataset.chartConfig) ? dataset.chartConfig : {}, {}),
					dataset.precomputedStats === undefined ? null : jsonStringify(dataset.precomputedStats, null),
					typeof dataset.sizeLabel === 'string' ? dataset.sizeLabel : null,
					fingerprint.fingerprint,
					fingerprint.algorithm,
				],
			);
			bindExec(
				db,
				'INSERT INTO dataset_payload(dataset_id, rows_json) VALUES (?, ?)',
				[dataset.id, jsonStringify(Array.isArray(dataset.rows) ? dataset.rows : [], [])],
			);
		});

		bindExec(
			db,
			'INSERT INTO app_state(key, doc) VALUES (?, ?)',
			['data_state', jsonStringify({ activeDatasetId }, { activeDatasetId: null })],
		);
		bindExec(
			db,
			'INSERT INTO app_state(key, doc) VALUES (?, ?)',
			['panel', jsonStringify(panelDoc, {})],
		);

		snapshotPayloads.forEach(payload => {
			bindExec(
				db,
				'INSERT INTO panel_snapshot_payload(chart_id, rows_json, columns_json) VALUES (?, ?, ?)',
				[
					payload.chartId,
					jsonStringify(payload.rows, []),
					jsonStringify(payload.columns, []),
				],
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
 * @returns {{ data: { datasets: Array<Object>, activeDatasetId: string | null }, panel: Object | null }}
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
	const panelDoc = isPlainObject(appStateDocs.panel) ? appStateDocs.panel : null;
	const payloadByChartId = new Map(
		selectRows(db, 'SELECT chart_id, rows_json, columns_json FROM panel_snapshot_payload')
			.map(row => [Number(row.chart_id), {
				rows: jsonParse(row.rows_json, []),
				columns: jsonParse(row.columns_json, []),
			}])
	);

	const panel = panelDoc
		? {
			...panelDoc,
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

	const dataState = isPlainObject(appStateDocs.data_state) ? appStateDocs.data_state : {};
	return {
		data: {
			datasets,
			activeDatasetId: dataState.activeDatasetId || null,
		},
		panel,
	};
}
