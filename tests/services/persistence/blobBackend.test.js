// @vitest-environment jsdom

import { beforeAll, describe, expect, it } from 'vitest';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import {
	createBlobBackend,
	SQLITE_IDB_PROJECT_KEY,
	SQLITE_IDB_STORE,
} from '../../../src/services/persistence/blobBackend.js';

let sqlite3Ready;
let dbCounter = 0;

beforeAll(() => {
	sqlite3Ready = sqlite3InitModule().then(sqlite3 => {
		sqlite3.config.log = () => {};
		sqlite3.config.warn = () => {};
		return sqlite3;
	});
});

function nextBackend() {
	dbCounter += 1;
	return createBlobBackend({
		initSqlite: () => sqlite3Ready,
		dbName: `chive-sqlite-test-${dbCounter}`,
	});
}

function makeSnapshot() {
	return {
		data: {
			datasets: [{
				id: 'ds-1',
				name: 'a.csv',
				rows: [{ x: 1 }],
				columns: [{ name: 'x', type: 'number' }],
				selectedColumns: ['x'],
				chartConfig: {},
			}],
			activeIndex: 0,
		},
		panel: {
			charts: [{ id: 0, type: 'bar', config: {}, dataSnapshot: [{ x: 1 }], columnsSnapshot: [{ name: 'x', type: 'number' }] }],
			slots: {},
			layout: 'template-2col',
			blocks: [],
			nextBlockId: 1,
			nextChartId: 1,
		},
	};
}

function openDb(name) {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(name, 1);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

function readStoredBlob(name) {
	return openDb(name).then(db => new Promise((resolve, reject) => {
		const tx = db.transaction(SQLITE_IDB_STORE, 'readonly');
		const req = tx.objectStore(SQLITE_IDB_STORE).get(SQLITE_IDB_PROJECT_KEY);
		req.onsuccess = () => {
			db.close();
			resolve(req.result);
		};
		req.onerror = () => {
			db.close();
			reject(req.error);
		};
	}));
}

describe('blobBackend', () => {
	it('persists one SQLite blob and hydrates it back', async () => {
		const backend = nextBackend();
		const dbName = `chive-sqlite-test-${dbCounter}`;
		await backend.persist(makeSnapshot());

		const stored = await readStoredBlob(dbName);
		expect(ArrayBuffer.isView(stored)).toBe(true);
		expect(stored.byteLength).toBeGreaterThan(0);

		const restored = await backend.hydrate();
		expect(restored.data.activeDatasetId).toBe('ds-1');
		expect(restored.data.datasets[0].rows).toEqual([{ x: 1 }]);
		expect(restored.panel.charts[0].dataSnapshot).toEqual([{ x: 1 }]);
	});

	it('returns null on first visit and after clear', async () => {
		const backend = nextBackend();
		expect(await backend.hydrate()).toBeNull();

		await backend.persist(makeSnapshot());
		expect(await backend.hydrate()).not.toBeNull();

		await backend.clear();
		expect(await backend.hydrate()).toBeNull();
	});
});
