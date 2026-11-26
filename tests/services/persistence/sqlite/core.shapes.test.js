import { beforeAll, describe, expect, it } from 'vitest';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { applySchema, readSnapshot, writeSnapshot } from '../../../../src/services/persistence/sqlite/core.js';

let sqlite3;
let dbCount = 0;

beforeAll(async () => {
	sqlite3 = await sqlite3InitModule();
	sqlite3.config.log = () => {};
	sqlite3.config.warn = () => {};
});

function withDb(run) {
	dbCount += 1;
	const db = new sqlite3.oo1.DB(`/core-shapes-${dbCount}.sqlite3`, 'ct');
	try {
		return run(db);
	} finally {
		db.close();
	}
}

function selectRows(db, sql) {
	const rows = [];
	db.exec({ sql, rowMode: 'object', callback: row => rows.push(row) });
	return rows;
}

const FINGERPRINTS = { 'ds-1': { fingerprint: 'hash-1', algorithm: 'test-v1' } };

describe('writeSnapshot with malformed input', () => {
	it('accepts fingerprints as a plain object keyed by dataset id', () => {
		withDb(db => {
			writeSnapshot(db, { data: { datasets: [{ id: 'ds-1', rows: [] }] } }, { fingerprintsByDatasetId: FINGERPRINTS });

			expect(selectRows(db, 'SELECT fingerprint, fingerprint_algorithm FROM datasets')).toEqual([
				{ fingerprint: 'hash-1', fingerprint_algorithm: 'test-v1' },
			]);
		});
	});

	it('stores defaults for dataset fields of the wrong type', () => {
		withDb(db => {
			writeSnapshot(db, {
				data: {
					datasets: [{
						id: 'ds-1',
						name: 42,
						rows: 'corrupt',
						columns: 'corrupt',
						selectedColumns: { city: true },
						chartConfig: ['corrupt'],
						sizeLabel: 1024,
					}],
					activeIndex: 0,
				},
			}, { fingerprintsByDatasetId: FINGERPRINTS });

			const [row] = selectRows(db, 'SELECT * FROM datasets');
			expect(row).toMatchObject({
				name: '',
				columns_json: '[]',
				selected_columns_json: '[]',
				chart_config_json: '{}',
				precomputed_stats_json: null,
				size_label: null,
			});
			expect(selectRows(db, 'SELECT rows_json FROM dataset_payload')).toEqual([{ rows_json: '[]' }]);
		});
	});

	it('skips datasets without an id and resolves the active id only for a valid index', () => {
		const datasets = [{ name: 'no id' }, { id: 'ds-1', rows: [] }];
		const activeIdFor = activeIndex => withDb(db => {
			writeSnapshot(db, { data: { datasets, activeIndex } }, { fingerprintsByDatasetId: FINGERPRINTS });
			expect(selectRows(db, 'SELECT id FROM datasets')).toEqual([{ id: 'ds-1' }]);
			return readSnapshot(db).data.activeDatasetId;
		});

		expect(activeIdFor(1)).toBe('ds-1');
		expect(activeIdFor(0)).toBeNull();     // points at the id-less dataset
		expect(activeIdFor(2)).toBeNull();     // past the end
		expect(activeIdFor('1')).toBeNull();   // not an integer
	});

	it('writes an empty project for a snapshot without datasets or panel', () => {
		withDb(db => {
			writeSnapshot(db, { data: { datasets: 'corrupt' }, panel: 'corrupt' });

			expect(selectRows(db, 'SELECT id FROM datasets')).toEqual([]);
			const panelDoc = JSON.parse(selectRows(db, "SELECT doc FROM app_state WHERE key = 'panel'")[0].doc);
			expect(panelDoc).toEqual({
				blocks: [],
				charts: [],
				slots: {},
				layout: 'template-2col',
				nextBlockId: 1,
				nextChartId: 0,
			});
		});
	});

	it('defaults panel fields of the wrong type and keeps valid ones', () => {
		withDb(db => {
			writeSnapshot(db, {
				panel: { charts: 'corrupt', slots: ['corrupt'], layout: 3, nextBlockId: 1.5, nextChartId: '9' },
			});
			const panel = readSnapshot(db).panel;
			expect(panel).toMatchObject({ charts: [], slots: {}, layout: 'template-2col', nextBlockId: 1, nextChartId: 0 });

			writeSnapshot(db, { panel: { charts: [], slots: { 'slot-1': 2 }, layout: 'template-3col', nextBlockId: 4, nextChartId: 5 } });
			expect(readSnapshot(db).panel).toMatchObject({
				slots: { 'slot-1': 2 },
				layout: 'template-3col',
				nextBlockId: 4,
				nextChartId: 5,
			});
		});
	});

	it('saves chart snapshots only for integer ids and empties non-array payloads', () => {
		withDb(db => {
			writeSnapshot(db, {
				panel: {
					charts: [
						{ id: 3, name: 7, dataSnapshot: 'corrupt', columnsSnapshot: { city: 'text' } },
						{ id: 'draft', name: 'Draft', dataSnapshot: [{ a: 1 }], columnsSnapshot: [] },
					],
				},
			});

			expect(selectRows(db, 'SELECT * FROM panel_snapshot_payload')).toEqual([
				{ chart_id: 3, rows_json: '[]', columns_json: '[]' },
			]);
			const charts = readSnapshot(db).panel.charts;
			expect(charts[0]).toEqual({ id: 3, name: 7, dataSnapshot: [], columnsSnapshot: [] });
			// A chart whose id is not an integer has nowhere to keep its rows.
			expect(charts[1]).toEqual({ id: 'draft', name: 'Draft', dataSnapshot: [], columnsSnapshot: [] });
		});
	});

	it('keeps a placement payload only when both its rows and columns are arrays', () => {
		withDb(db => {
			writeSnapshot(db, {
				panel: {
					charts: [{ id: 1, dataSnapshot: [], columnsSnapshot: [] }],
					blocks: [{
						id: 'block-1',
						slots: { 'slot-1': 1, 'slot-2': 2 },
						placements: {
							'slot-1': { followGlobalFilter: false, dataSnapshot: [{ a: 1 }] },
							'slot-2': { followGlobalFilter: false, dataSnapshot: [{ a: 2 }], columnsSnapshot: [] },
						},
					}],
				},
			});

			const stored = selectRows(db, 'SELECT block_id, slot_id, rows_json FROM panel_placement_payload');
			expect(stored).toEqual([{ block_id: 'block-1', slot_id: 'slot-2', rows_json: '[{"a":2}]' }]);
			const placements = readSnapshot(db).panel.blocks[0].placements;
			expect(placements['slot-1']).toEqual({ followGlobalFilter: false });
			expect(placements['slot-2']).toEqual({ followGlobalFilter: false, dataSnapshot: [{ a: 2 }], columnsSnapshot: [] });
		});
	});
});

describe('readSnapshot with damaged stored values', () => {
	function seed(db, { datasetRow = {}, appState = [] } = {}) {
		applySchema(db);
		const row = {
			id: 'ds-1',
			position: 0,
			name: 'A.csv',
			columns_json: '[]',
			selected_columns_json: '[]',
			chart_config_json: '{}',
			precomputed_stats_json: null,
			size_label: null,
			fingerprint: 'hash-1',
			fingerprint_algorithm: 'test-v1',
			...datasetRow,
		};
		db.exec({
			sql: `INSERT INTO datasets VALUES (${Object.keys(row).map(() => '?').join(', ')})`,
			bind: Object.values(row),
		});
		for (const [key, doc] of appState) {
			db.exec({ sql: 'INSERT INTO app_state(key, doc) VALUES (?, ?)', bind: [key, doc] });
		}
	}

	it('falls back per field when stored JSON is unparseable or not text', () => {
		withDb(db => {
			seed(db, {
				datasetRow: {
					columns_json: '{not json',
					// A blob survives TEXT affinity, so a crafted file can hand back bytes.
					// These stringify to "55", which would parse if not rejected first.
					selected_columns_json: new Uint8Array([55]),
					precomputed_stats_json: 'oops',
				},
			});

			const [dataset] = readSnapshot(db).data.datasets;
			expect(dataset).toMatchObject({ columns: [], selectedColumns: [], chartConfig: {}, sizeLabel: '' });
			expect(dataset.precomputedStats).toBeUndefined();
		});
	});

	it('reports missing rows as null when a dataset has no payload row', () => {
		withDb(db => {
			seed(db);
			expect(readSnapshot(db).data.datasets[0].rows).toBeNull();
		});
	});

	it('returns no panel and no active dataset when the app state docs are unusable', () => {
		withDb(db => {
			seed(db, { appState: [['panel', '["not","an","object"]'], ['data_state', 'null']] });

			const snapshot = readSnapshot(db);
			expect(snapshot.panel).toBeNull();
			expect(snapshot.data.activeDatasetId).toBeNull();
		});
	});

	it('reads a stored panel whose chart list is not an array as having no charts', () => {
		withDb(db => {
			seed(db, { appState: [['panel', '{"charts":"corrupt","layout":"template-2col"}']] });

			expect(readSnapshot(db).panel).toEqual({ charts: [], blocks: [], layout: 'template-2col' });
		});
	});
});
