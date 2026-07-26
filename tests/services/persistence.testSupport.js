import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { createBlobBackend } from '../../src/services/persistence/backends/blobBackend.js';

const sqlite3Ready = sqlite3InitModule().then(sqlite3 => {
	sqlite3.config.log = () => {};
	sqlite3.config.warn = () => {};
	return sqlite3;
});

let backendCounter = 0;

/**
 * A real SQLite blob backend over fake-indexeddb, on its own database.
 *
 * Pass `dbName` when the test also needs to reach that database directly, for
 * example to hold a connection open and force a blocked delete.
 *
 * @param {{ dbName?: string }} [options]
 */
export function makeBackend({ dbName } = {}) {
	backendCounter += 1;
	return createBlobBackend({
		initSqlite: () => sqlite3Ready,
		dbName: dbName || `chive-service-test-${backendCounter}`,
	});
}

export function makeSnapshot(overrides = {}) {
	return {
		data: {
			datasets: [
				{
					id: 'ds-1',
					name: 'a.csv',
					rows: [{ x: 1 }],
					columns: [{ name: 'x', type: 'number' }],
					selectedColumns: ['x'],
					chartConfig: {},
				},
				{
					id: 'ds-2',
					name: 'b.csv',
					rows: [{ y: 2 }],
					columns: [{ name: 'y', type: 'number' }],
					selectedColumns: ['y'],
					chartConfig: {},
				},
			],
			activeIndex: 1,
		},
		panel: {
			charts: [{
				id: 0,
				type: 'bar',
				config: { color: '#abc' },
				dataSnapshot: [{ y: 2 }],
				columnsSnapshot: [{ name: 'y', type: 'number' }],
			}],
			slots: {},
			layout: 'template-2col',
			blocks: [{ id: 'block-1', templateId: 'template-2col', slots: {}, proportions: { split: 50 } }],
			nextBlockId: 2,
			nextChartId: 1,
		},
		ui: {
			sidebarMode: 'panel',
			previewRows: 25,
		},
		...overrides,
	};
}

export function goodRecord(id = 'good') {
	return {
		id,
		name: `${id}.csv`,
		rows: [{ x: 1 }],
		columns: [{ name: 'x', type: 'number' }],
		selectedColumns: ['x'],
		chartConfig: {},
	};
}

export function writeLegacyState({ datasets, panelRecord }) {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open('chive-state', 2);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains('datasets')) {
				db.createObjectStore('datasets', { keyPath: 'id' });
			}
			if (!db.objectStoreNames.contains('panel')) {
				db.createObjectStore('panel', { keyPath: 'key' });
			}
		};
		req.onerror = () => reject(req.error);
		req.onsuccess = () => {
			const db = req.result;
			const tx = db.transaction(['datasets', 'panel'], 'readwrite');
			const dsStore = tx.objectStore('datasets');
			datasets.forEach(dataset => dsStore.put(dataset));
			tx.objectStore('panel').put({ key: 'singleton', ...panelRecord });
			tx.oncomplete = () => {
				db.close();
				resolve();
			};
			tx.onerror = () => {
				db.close();
				reject(tx.error);
			};
		};
	});
}

export function setDocumentVisibilityState(value) {
	const original = Object.getOwnPropertyDescriptor(document, 'visibilityState');
	Object.defineProperty(document, 'visibilityState', { configurable: true, value });
	return () => {
		if (original) {
			Object.defineProperty(document, 'visibilityState', original);
		} else {
			delete document.visibilityState;
		}
	};
}

export async function flushMicrotasks(count = 3) {
	for (let i = 0; i < count; i += 1) {
		await Promise.resolve();
	}
}
