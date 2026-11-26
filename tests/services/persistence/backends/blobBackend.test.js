// @vitest-environment jsdom

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import {
	createBlobBackend,
	openSerializedDb,
	recordToBytes,
	SQLITE_IDB_PROJECT_KEY,
	SQLITE_IDB_STORE,
} from '../../../../src/services/persistence/backends/blobBackend.js';

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

	it('exports full SQLite bytes without writing browser persistence and imports them back', async () => {
		const backend = nextBackend();
		const bytes = await backend.exportBytes(makeSnapshot());

		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(bytes.byteLength).toBeGreaterThan(0);
		expect(await backend.hydrate()).toBeNull();

		const imported = await backend.importBytes(bytes);
		expect(imported.data.datasets[0].rows).toEqual([{ x: 1 }]);
		expect(imported.panel.charts[0].dataSnapshot).toEqual([{ x: 1 }]);
	});

	it('work-only export keeps project metadata but omits heavy payload tables', async () => {
		const backend = nextBackend();
		const snapshot = makeSnapshot();
		snapshot.data.datasets[0].rows = [{ x: 'payload'.repeat(10000) }];
		snapshot.panel.charts[0].dataSnapshot = snapshot.data.datasets[0].rows;

		const fullBytes = await backend.exportBytes(snapshot);
		const workOnlyBytes = await backend.exportBytes(snapshot, { omitDataPayloads: true });
		const imported = await backend.importBytes(workOnlyBytes);

		expect(imported.data.datasets[0].id).toBe('ds-1');
		expect(imported.data.datasets[0].rows).toBeNull();
		expect(imported.panel.charts[0].dataSnapshot).toEqual([]);
		expect(imported.panel.charts[0].columnsSnapshot).toEqual([]);
		expect(workOnlyBytes.byteLength).toBeLessThan(fullBytes.byteLength);
	});

	it('still omits payloads for the former workOnly option name', async () => {
		// A page left open across a deploy keeps its old workerBackend, which can
		// import this module later as its fallback and pass `workOnly`.
		const backend = nextBackend();
		const bytes = await backend.exportBytes(makeSnapshot(), { workOnly: true });
		const imported = await backend.importBytes(bytes);

		expect(imported.data.datasets[0].rows).toBeNull();
		expect(imported.panel.charts[0].dataSnapshot).toEqual([]);
	});

	it('rejects invalid or empty import bytes', async () => {
		const backend = nextBackend();

		await expect(backend.importBytes(new Uint8Array())).rejects.toMatchObject({ name: 'EmptyProjectFileError' });
		await expect(backend.importBytes(new Uint8Array([1, 2, 3]))).rejects.toThrow(/database|deserialize/i);
	});

	it('names a dataset too large to fingerprint and keeps the previous save', async () => {
		const backend = nextBackend();
		await backend.persist(makeSnapshot());

		const snapshot = makeSnapshot();
		snapshot.data.datasets[0].rows = [{ x: { toJSON() { throw new RangeError('Invalid string length'); } } }];
		await expect(backend.persist(snapshot)).rejects.toMatchObject({
			name: 'PayloadTooLargeError',
			tooLarge: { kind: 'dataset', name: 'a.csv' },
		});

		const restored = await backend.hydrate();
		expect(restored.data.datasets[0].rows).toEqual([{ x: 1 }]);
	});
});

describe('blobBackend, IndexedDB failures', () => {
	const originalIndexedDb = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');

	afterEach(() => {
		Object.defineProperty(globalThis, 'indexedDB', originalIndexedDb);
	});

	function installIndexedDb(descriptor) {
		Object.defineProperty(globalThis, 'indexedDB', { configurable: true, ...descriptor });
	}

	// Minimal IDB double. Each option makes one request or transaction fail
	// asynchronously, the way a real browser reports it.
	function failingIndexedDb({ openError, readError, writeFailure, deleteError } = {}) {
		const fire = (target, handler, props) => setTimeout(() => {
			Object.assign(target, props);
			target[handler]?.();
		});
		const db = {
			objectStoreNames: { contains: () => true },
			close: vi.fn(),
			transaction() {
				const tx = {
					error: null,
					objectStore: () => ({
						get() {
							const req = {};
							if (readError) fire(req, 'onerror', { error: readError });
							else fire(req, 'onsuccess', { result: undefined });
							return req;
						},
						put() {
							if (writeFailure) fire(tx, writeFailure.handler, { error: writeFailure.error });
							else fire(tx, 'oncomplete', {});
						},
					}),
				};
				return tx;
			},
		};
		return {
			db,
			open() {
				const req = {};
				if (openError) fire(req, 'onerror', { error: openError });
				else fire(req, 'onsuccess', { result: db });
				return req;
			},
			deleteDatabase() {
				const req = {};
				if (deleteError) fire(req, 'onerror', { error: deleteError });
				else fire(req, 'onsuccess', {});
				return req;
			},
		};
	}

	it('treats a throwing indexedDB accessor as unavailable storage', async () => {
		// Sandboxed iframes and some privacy modes throw on the property read itself.
		installIndexedDb({ get() { throw new DOMException('denied', 'SecurityError'); } });
		const backend = nextBackend();

		expect(backend.available()).toBe(false);
		await expect(backend.hydrate()).resolves.toBeNull();
		await expect(backend.persist(makeSnapshot())).rejects.toThrow('IndexedDB is unavailable');
		await expect(backend.clear()).resolves.toEqual({ ok: false, reason: 'unavailable' });
	});

	it('rejects hydrate with the open request error', async () => {
		const openError = new DOMException('version change blocked', 'VersionError');
		installIndexedDb({ value: failingIndexedDb({ openError }) });

		await expect(nextBackend().hydrate()).rejects.toBe(openError);
	});

	it('rejects hydrate with the read error and still closes the connection', async () => {
		const readError = new DOMException('read failed', 'UnknownError');
		const idb = failingIndexedDb({ readError });
		installIndexedDb({ value: idb });

		await expect(nextBackend().hydrate()).rejects.toBe(readError);
		expect(idb.db.close).toHaveBeenCalledTimes(1);
	});

	it.each(['onabort', 'onerror'])('rejects persist with the transaction error from %s', async handler => {
		// A quota failure aborts the write transaction. The original error must
		// reach the caller unchanged so isQuotaError can classify it by name.
		const quota = new DOMException('quota', 'QuotaExceededError');
		const idb = failingIndexedDb({ writeFailure: { handler, error: quota } });
		installIndexedDb({ value: idb });

		await expect(nextBackend().persist(makeSnapshot())).rejects.toBe(quota);
		expect(idb.db.close).toHaveBeenCalledTimes(1);
	});

	it('reports a failed delete as an error outcome rather than a success', async () => {
		installIndexedDb({ value: failingIndexedDb({ deleteError: new DOMException('nope', 'UnknownError') }) });

		await expect(nextBackend().clear()).resolves.toEqual({ ok: false, reason: 'error' });
	});
});

describe('blobBackend, byte handling', () => {
	it('reads typed-array, ArrayBuffer, and Blob records as bytes', async () => {
		const source = new Uint8Array([0, 1, 2, 3, 4]);

		expect(await recordToBytes(source.subarray(1, 4))).toEqual(new Uint8Array([1, 2, 3]));
		expect(await recordToBytes(source.buffer.slice(0))).toEqual(source);
		// jsdom Blob has no arrayBuffer(); browsers and workers do.
		const blob = new Blob([source]);
		blob.arrayBuffer = async () => source.buffer.slice(0);
		expect(await recordToBytes(blob)).toEqual(source);
		expect(await recordToBytes('not bytes')).toBeNull();
		expect(await recordToBytes(null)).toBeNull();
	});

	it('frees the copied bytes and closes the database when deserialize fails', () => {
		const db = { pointer: 7, close: vi.fn() };
		const sqlite3 = {
			oo1: { DB: vi.fn(function DB() { return db; }) },
			capi: {
				sqlite3_trace_v2: vi.fn(),
				sqlite3_deserialize: vi.fn(() => 21),
				SQLITE_DESERIALIZE_FREEONCLOSE: 1,
			},
			wasm: { allocFromTypedArray: vi.fn(() => 1234), dealloc: vi.fn() },
		};

		expect(() => openSerializedDb(sqlite3, new Uint8Array([1, 2]))).toThrow('sqlite3_deserialize failed: 21');
		expect(sqlite3.wasm.dealloc).toHaveBeenCalledWith(1234);
		expect(db.close).toHaveBeenCalledTimes(1);
	});

	it('rethrows a fingerprint failure that is not a size limit unchanged', async () => {
		const backend = nextBackend();
		const failure = new TypeError('cannot serialize cell');
		const snapshot = makeSnapshot();
		snapshot.data.datasets[0].rows = [{ x: { toJSON() { throw failure; } } }];

		await expect(backend.persist(snapshot)).rejects.toBe(failure);
	});
});
