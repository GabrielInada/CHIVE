/**
 * One-time reader for the raw IndexedDB persistence format used before the
 * SQLite blob migration.
 */

export const LEGACY_DB_NAME = 'chive-state';
export const LEGACY_STORE_DATASETS = 'datasets';
export const LEGACY_STORE_PANEL = 'panel';
export const LEGACY_PANEL_KEY = 'singleton';
export const LEGACY_MIGRATION_MARKER_KEY = 'chive.migrated';

function getIndexedDb() {
	try {
		return typeof indexedDB !== 'undefined' ? indexedDB : null;
	} catch {
		return null;
	}
}

function openLegacyDb() {
	return new Promise((resolve, reject) => {
		const req = getIndexedDb().open(LEGACY_DB_NAME);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

function readAll(db, storeName) {
	if (!db.objectStoreNames.contains(storeName)) return Promise.resolve([]);
	return new Promise((resolve, reject) => {
		const tx = db.transaction(storeName, 'readonly');
		const req = tx.objectStore(storeName).getAll();
		req.onsuccess = () => resolve(req.result || []);
		req.onerror = () => reject(req.error);
	});
}

function readOne(db, storeName, key) {
	if (!db.objectStoreNames.contains(storeName)) return Promise.resolve(null);
	return new Promise((resolve, reject) => {
		const tx = db.transaction(storeName, 'readonly');
		const req = tx.objectStore(storeName).get(key);
		req.onsuccess = () => resolve(req.result || null);
		req.onerror = () => reject(req.error);
	});
}

/**
 * @returns {boolean}
 */
export function hasLegacyMigrationMarker() {
	try {
		return localStorage.getItem(LEGACY_MIGRATION_MARKER_KEY) === '1';
	} catch {
		return false;
	}
}

export function setLegacyMigrationMarker() {
	try {
		localStorage.setItem(LEGACY_MIGRATION_MARKER_KEY, '1');
	} catch {
		// Best effort. Without localStorage we still avoid using legacy as a
		// persistent backend; the next boot can retry the import.
	}
}

/**
 * Read old raw-IDB state without mutating it.
 *
 * @returns {Promise<null | { data: { datasets: Array<Object>, activeDatasetId: string | null }, panel: Object | null }>}
 */
export async function readLegacyState() {
	if (!getIndexedDb()) return null;
	let db;
	try {
		db = await openLegacyDb();
		const [datasets, panelRecord] = await Promise.all([
			readAll(db, LEGACY_STORE_DATASETS),
			readOne(db, LEGACY_STORE_PANEL, LEGACY_PANEL_KEY),
		]);
		if (datasets.length === 0 && !panelRecord) return null;
		const panel = { ...(panelRecord || {}) };
		delete panel.key;
		const activeDatasetId = panel.activeDatasetId;
		delete panel.activeDatasetId;
		return {
			data: {
				datasets,
				activeDatasetId: activeDatasetId || null,
			},
			panel: panelRecord ? panel : null,
		};
	} finally {
		if (db) db.close();
	}
}

/**
 * Delete the old raw-IDB database and report what happened.
 *
 * Never rejects: the migration path treats a failed legacy delete as
 * non-fatal. Callers that surface the result to a user, such as stored-data
 * clearing, read the returned outcome instead. `blocked` means another
 * connection still holds the database; the request stays pending until that
 * connection closes, which may never happen.
 *
 * @returns {Promise<{ ok: boolean, reason?: 'blocked' | 'error' | 'unavailable' }>}
 */
export async function deleteLegacyState() {
	if (!getIndexedDb()) return { ok: false, reason: 'unavailable' };
	return new Promise(resolve => {
		const req = getIndexedDb().deleteDatabase(LEGACY_DB_NAME);
		req.onsuccess = () => resolve({ ok: true });
		req.onerror = () => resolve({ ok: false, reason: 'error' });
		req.onblocked = () => resolve({ ok: false, reason: 'blocked' });
	});
}
