import { beforeAll, describe, expect, it } from 'vitest';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { applySchema, assertMeta, readSnapshot, writeSnapshot } from '../../../../src/services/persistence/sqlite/core.js';

let sqlite3;

beforeAll(async () => {
	sqlite3 = await sqlite3InitModule();
	sqlite3.config.log = () => {};
	sqlite3.config.warn = () => {};
});

function makeDb(name = '/core-test.sqlite3') {
	return new sqlite3.oo1.DB(name, 'ct');
}

function selectRows(db, sql) {
	const rows = [];
	db.exec({ sql, rowMode: 'object', callback: row => rows.push(row) });
	return rows;
}

function makeSnapshot() {
	return {
		data: {
			datasets: [
				{
					id: 'ds-b',
					name: 'B.csv',
					rows: [{ city: 'B', value: 2 }],
					columns: [{ name: 'city', type: 'text' }, { name: 'value', type: 'number' }],
					selectedColumns: ['city', 'value'],
					chartConfig: { activeTab: 'charts', bar: { category: 'city' } },
					precomputedStats: { numeric: { value: { min: 2 } }, categorical: {} },
					sizeLabel: '1 KB',
				},
				{
					id: 'ds-a',
					name: 'A.csv',
					rows: [{ city: 'A', value: 1 }],
					columns: [{ name: 'city', type: 'text' }, { name: 'value', type: 'number' }],
					selectedColumns: ['city'],
					chartConfig: {},
				},
			],
			activeIndex: 1,
		},
		panel: {
			charts: [{
				id: 7,
				name: 'Saved',
				type: 'bar',
				config: { category: 'city' },
				dataSnapshot: [{ city: 'A', value: 1 }],
				columnsSnapshot: [{ name: 'city', type: 'text' }],
				metadata: { type: 'bar' },
				metaSummary: 'City',
				createdAt: '2026-06-03T00:00:00.000Z',
			}],
			slots: { 'slot-1': 7 },
			layout: 'template-2col',
			blocks: [{ id: 'block-1', templateId: 'template-2col', slots: { 'slot-1': 7 }, proportions: { split: 50 } }],
			nextBlockId: 2,
			nextChartId: 8,
		},
	};
}

function makeFingerprints() {
	return new Map([
		['ds-b', { fingerprint: 'hash-b', algorithm: 'test-v1' }],
		['ds-a', { fingerprint: 'hash-a', algorithm: 'test-v1' }],
	]);
}

describe('sqliteCore', () => {
	it('creates the export-ready schema including dataset position', () => {
		const db = makeDb('/schema-test.sqlite3');
		try {
			applySchema(db);
			const tables = selectRows(db, "SELECT name, sql FROM sqlite_master WHERE type = 'table' ORDER BY name");
			expect(tables.map(row => row.name)).toEqual([
				'app_state',
				'dataset_payload',
				'datasets',
				'meta',
				'panel_snapshot_payload',
			]);
			expect(tables.find(row => row.name === 'datasets').sql).toContain('position INTEGER NOT NULL');
		} finally {
			db.close();
		}
	});

	it('round-trips datasets, active dataset id, and split chart snapshot payloads', () => {
		const db = makeDb('/roundtrip-test.sqlite3');
		try {
			writeSnapshot(db, makeSnapshot(), { fingerprintsByDatasetId: makeFingerprints() });
			const storedCharts = selectRows(db, "SELECT doc FROM app_state WHERE key = 'panel'");
			expect(JSON.parse(storedCharts[0].doc).charts[0]).not.toHaveProperty('dataSnapshot');
			expect(selectRows(db, 'SELECT * FROM panel_snapshot_payload')).toHaveLength(1);
			expect(selectRows(db, 'SELECT * FROM dataset_payload')).toHaveLength(2);

			const restored = readSnapshot(db);
			expect(restored.data.datasets.map(dataset => dataset.id)).toEqual(['ds-b', 'ds-a']);
			expect(restored.data.activeDatasetId).toBe('ds-a');
			expect(restored.data.datasets[0].rows).toEqual([{ city: 'B', value: 2 }]);
			expect(restored.data.datasets[0].fingerprint).toBe('hash-b');
			expect(restored.panel.charts[0].dataSnapshot).toEqual([{ city: 'A', value: 1 }]);
			expect(restored.panel.charts[0].columnsSnapshot).toEqual([{ name: 'city', type: 'text' }]);
		} finally {
			db.close();
		}
	});

	it('throws when a persisted dataset is missing its computed fingerprint', () => {
		const db = makeDb('/missing-fingerprint-test.sqlite3');
		try {
			expect(() => writeSnapshot(db, makeSnapshot(), { fingerprintsByDatasetId: new Map() }))
				.toThrow('Missing fingerprint for dataset ds-b');
		} finally {
			db.close();
		}
	});

	it('requires CHIVE metadata when requested for project import', () => {
		const db = makeDb('/missing-meta-test.sqlite3');
		try {
			applySchema(db);
			expect(() => assertMeta(db)).not.toThrow();
			expect(() => assertMeta(db, { requireMeta: true })).toThrow('Missing CHIVE SQLite project metadata');
		} finally {
			db.close();
		}
	});

	it.each([
		{
			name: 'format',
			rows: [['format', 'chive-project']],
		},
		{
			name: 'schema_version',
			rows: [['schema_version', '1']],
		},
	])('rejects import metadata when $name is the only required key', ({ rows }) => {
		const db = makeDb(`/partial-meta-${rows[0][0]}.sqlite3`);
		try {
			applySchema(db);
			for (const [key, value] of rows) {
				db.exec({ sql: 'INSERT INTO meta(key, value) VALUES (?, ?)', bind: [key, value] });
			}
			expect(() => assertMeta(db, { requireMeta: true })).toThrow('Missing CHIVE SQLite project metadata');
		} finally {
			db.close();
		}
	});

	it('accepts both exact required metadata values', () => {
		const db = makeDb('/complete-meta-test.sqlite3');
		try {
			applySchema(db);
			db.exec({ sql: 'INSERT INTO meta(key, value) VALUES (?, ?)', bind: ['format', 'chive-project'] });
			db.exec({ sql: 'INSERT INTO meta(key, value) VALUES (?, ?)', bind: ['schema_version', '1'] });
			expect(() => assertMeta(db, { requireMeta: true })).not.toThrow();
		} finally {
			db.close();
		}
	});

	it('rejects mismatched required metadata values', () => {
		const wrongFormat = makeDb('/wrong-format-meta-test.sqlite3');
		try {
			applySchema(wrongFormat);
			wrongFormat.exec({ sql: 'INSERT INTO meta(key, value) VALUES (?, ?)', bind: ['format', 'other-project'] });
			wrongFormat.exec({ sql: 'INSERT INTO meta(key, value) VALUES (?, ?)', bind: ['schema_version', '1'] });
			expect(() => assertMeta(wrongFormat, { requireMeta: true })).toThrow('Unsupported CHIVE SQLite format');
		} finally {
			wrongFormat.close();
		}

		const wrongVersion = makeDb('/wrong-version-meta-test.sqlite3');
		try {
			applySchema(wrongVersion);
			wrongVersion.exec({ sql: 'INSERT INTO meta(key, value) VALUES (?, ?)', bind: ['format', 'chive-project'] });
			wrongVersion.exec({ sql: 'INSERT INTO meta(key, value) VALUES (?, ?)', bind: ['schema_version', '2'] });
			expect(() => assertMeta(wrongVersion, { requireMeta: true })).toThrow('Unsupported CHIVE SQLite schema version');
		} finally {
			wrongVersion.close();
		}
	});
});
