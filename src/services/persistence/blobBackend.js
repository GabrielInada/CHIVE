/**
 * SQLite-WASM in-memory backend persisted as one byte image in IndexedDB.
 *
 * In production this runs WORKER-SIDE: `workers/persistWorker.js` constructs a
 * `createBlobBackend()` so all SQLite work (fingerprint + schema + export + IDB
 * write) happens off the main thread. The main-thread `workerBackend` also
 * dynamic-imports this module as a fallback when no worker is available. The
 * logic is environment-agnostic (IndexedDB + `crypto.subtle` exist in workers),
 * so it is reused verbatim in both places.
 */

import sqlite3InitModule from '../../../vendor/sqlite/sqlite3.js';
import { computeDatasetFingerprint } from '../../utils/datasetFingerprint.js';
import { applySchema, readSnapshot, writeSnapshot } from './sqliteCore.js';

export const SQLITE_IDB_NAME = 'chive-sqlite';
export const SQLITE_IDB_STORE = 'db';
export const SQLITE_IDB_PROJECT_KEY = 'project';

function getIndexedDb() {
	try {
		return typeof indexedDB !== 'undefined' ? indexedDB : null;
	} catch {
		return null;
	}
}

function openProjectStore({ dbName, storeName }) {
	return new Promise((resolve, reject) => {
		const req = getIndexedDb().open(dbName, 1);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(storeName)) {
				db.createObjectStore(storeName);
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

function readRecord(db, storeName, key) {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(storeName, 'readonly');
		const store = tx.objectStore(storeName);
		const req = store.get(key);
		req.onsuccess = () => resolve(req.result || null);
		req.onerror = () => reject(req.error);
	});
}

function writeRecord(db, storeName, key, value) {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(storeName, 'readwrite');
		tx.objectStore(storeName).put(value, key);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error);
	});
}

function deleteDatabase(dbName) {
	return new Promise(resolve => {
		const req = getIndexedDb().deleteDatabase(dbName);
		req.onsuccess = () => resolve();
		req.onerror = () => resolve();
		req.onblocked = () => resolve();
	});
}

async function recordToBytes(record) {
	if (!record) return null;
	if (ArrayBuffer.isView(record)) {
		return new Uint8Array(record.buffer, record.byteOffset, record.byteLength);
	}
	if (Object.prototype.toString.call(record) === '[object ArrayBuffer]') {
		return new Uint8Array(record);
	}
	if (typeof Blob !== 'undefined' && record instanceof Blob) {
		return new Uint8Array(await record.arrayBuffer());
	}
	return null;
}

function openSerializedDb(sqlite3, bytes) {
	const db = new sqlite3.oo1.DB('/chive-hydrate.sqlite3', 'ct');
	sqlite3.capi.sqlite3_trace_v2(db.pointer, 0, 0, 0);
	const ptr = sqlite3.wasm.allocFromTypedArray(bytes);
	const rc = sqlite3.capi.sqlite3_deserialize(
		db.pointer,
		'main',
		ptr,
		bytes.length,
		bytes.length,
		sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE,
	);
	if (rc) {
		sqlite3.wasm.dealloc(ptr);
		db.close();
		throw new Error(`sqlite3_deserialize failed: ${rc}`);
	}
	return db;
}

async function fingerprintDatasets(snapshot) {
	const datasets = Array.isArray(snapshot?.data?.datasets)
		? snapshot.data.datasets.filter(dataset => dataset?.id)
		: [];
	const fingerprints = new Map();
	for (const dataset of datasets) {
		fingerprints.set(dataset.id, await computeDatasetFingerprint(dataset));
	}
	return fingerprints;
}

/**
 * @param {Object} [options]
 * @param {() => Promise<*>} [options.initSqlite]
 * @param {string} [options.dbName]
 * @param {string} [options.storeName]
 * @param {string} [options.projectKey]
 */
export function createBlobBackend({
	initSqlite = sqlite3InitModule,
	dbName = SQLITE_IDB_NAME,
	storeName = SQLITE_IDB_STORE,
	projectKey = SQLITE_IDB_PROJECT_KEY,
} = {}) {
	let sqliteReady = null;

	function available() {
		return getIndexedDb() !== null;
	}

	async function getSqlite3() {
		if (!sqliteReady) sqliteReady = initSqlite();
		return sqliteReady;
	}

	async function hydrate() {
		if (!available()) return null;
		const idb = await openProjectStore({ dbName, storeName });
		let bytes;
		try {
			bytes = await recordToBytes(await readRecord(idb, storeName, projectKey));
		} finally {
			idb.close();
		}
		if (!bytes || bytes.length === 0) return null;

		const sqlite3 = await getSqlite3();
		let db;
		try {
			db = openSerializedDb(sqlite3, bytes);
			return readSnapshot(db);
		} finally {
			if (db) db.close();
		}
	}

	async function persist(snapshot) {
		if (!available()) throw new Error('IndexedDB is unavailable');
		const sqlite3 = await getSqlite3();
		const fingerprintsByDatasetId = await fingerprintDatasets(snapshot);
		let db;
		try {
			db = new sqlite3.oo1.DB('/chive-persist.sqlite3', 'ct');
			sqlite3.capi.sqlite3_trace_v2(db.pointer, 0, 0, 0);
			applySchema(db);
			writeSnapshot(db, snapshot, { fingerprintsByDatasetId });
			const bytes = sqlite3.capi.sqlite3_js_db_export(db);
			const idb = await openProjectStore({ dbName, storeName });
			try {
				await writeRecord(idb, storeName, projectKey, bytes.slice());
			} finally {
				idb.close();
			}
		} finally {
			if (db) db.close();
		}
	}

	async function clear() {
		if (!available()) return;
		await deleteDatabase(dbName);
	}

	return {
		available,
		hydrate,
		persist,
		clear,
	};
}

export const blobBackend = createBlobBackend();
