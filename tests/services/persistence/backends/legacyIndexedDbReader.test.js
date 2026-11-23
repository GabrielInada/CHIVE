// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	LEGACY_DB_NAME,
	deleteLegacyState,
	hasLegacyMigrationMarker,
	readLegacyState,
	setLegacyMigrationMarker,
} from '../../../../src/services/persistence/backends/legacyIndexedDbReader.js';

function request(fn) {
	return new Promise((resolve, reject) => {
		const req = fn();
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

/** Create the legacy database with only the stores and records given. */
async function seedLegacyDb({ datasets, panel } = {}) {
	const req = indexedDB.open(LEGACY_DB_NAME, 2);
	req.onupgradeneeded = () => {
		if (datasets) req.result.createObjectStore('datasets', { keyPath: 'id' });
		if (panel !== undefined) req.result.createObjectStore('panel', { keyPath: 'key' });
	};
	const db = await request(() => req);
	const stores = [...db.objectStoreNames];
	if (stores.length > 0) {
		const tx = db.transaction(stores, 'readwrite');
		for (const record of datasets || []) tx.objectStore('datasets').put(record);
		if (panel) tx.objectStore('panel').put({ key: 'singleton', ...panel });
		await new Promise(resolve => { tx.oncomplete = resolve; });
	}
	db.close();
}

const legacyDbNames = async () => (await indexedDB.databases()).map(info => info.name);

/** An IDB request that fails on the next tick, the way a real one reports errors. */
function failingRequest(error = new DOMException('boom', 'UnknownError')) {
	const req = { error };
	setTimeout(() => req.onerror?.());
	return req;
}

beforeEach(async () => {
	await request(() => indexedDB.deleteDatabase(LEGACY_DB_NAME));
	localStorage.clear();
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('readLegacyState', () => {
	it('splits the active dataset id out of the panel record and drops its key', async () => {
		await seedLegacyDb({
			datasets: [{ id: 'ds-1', rows: [] }, { id: 'ds-2', rows: [] }],
			panel: { activeDatasetId: 'ds-2', layout: 'template-2col', charts: [] },
		});

		await expect(readLegacyState()).resolves.toEqual({
			data: { datasets: [{ id: 'ds-1', rows: [] }, { id: 'ds-2', rows: [] }], activeDatasetId: 'ds-2' },
			panel: { layout: 'template-2col', charts: [] },
		});
	});

	it('reads datasets without a panel store as no panel and no active dataset', async () => {
		await seedLegacyDb({ datasets: [{ id: 'ds-1' }] });

		await expect(readLegacyState()).resolves.toEqual({
			data: { datasets: [{ id: 'ds-1' }], activeDatasetId: null },
			panel: null,
		});
	});

	it('reads a panel without a datasets store as an empty dataset list', async () => {
		await seedLegacyDb({ panel: { layout: 'template-3col' } });

		await expect(readLegacyState()).resolves.toEqual({
			data: { datasets: [], activeDatasetId: null },
			panel: { layout: 'template-3col' },
		});
	});

	it.each([
		['the stores are empty', { datasets: [], panel: null }],
		['the database has no stores', {}],
	])('returns null when %s', async (_label, seed) => {
		await seedLegacyDb(seed);

		await expect(readLegacyState()).resolves.toBeNull();
	});

	it('leaves the legacy records in place', async () => {
		await seedLegacyDb({ datasets: [{ id: 'ds-1' }], panel: { activeDatasetId: 'ds-1' } });

		const first = await readLegacyState();

		await expect(readLegacyState()).resolves.toEqual(first);
	});

	it('creates an empty legacy database when none exists', async () => {
		// The open has no version, so a missing database is created at version 1.
		// The import marker keeps later boots from opening it again.
		await expect(readLegacyState()).resolves.toBeNull();

		expect(await legacyDbNames()).toEqual([LEGACY_DB_NAME]);
	});

	it('returns null without IndexedDB, including when reading the global throws', async () => {
		vi.stubGlobal('indexedDB', undefined);
		await expect(readLegacyState()).resolves.toBeNull();

		vi.unstubAllGlobals();
		const original = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
		Object.defineProperty(globalThis, 'indexedDB', {
			configurable: true,
			get() { throw new DOMException('denied', 'SecurityError'); },
		});
		try {
			await expect(readLegacyState()).resolves.toBeNull();
		} finally {
			Object.defineProperty(globalThis, 'indexedDB', original);
		}
	});

	it('rejects with the open error', async () => {
		const error = new DOMException('quota', 'QuotaExceededError');
		vi.spyOn(indexedDB, 'open').mockImplementation(() => failingRequest(error));

		await expect(readLegacyState()).rejects.toBe(error);
	});

	it.each([
		['datasets', 'getAll'],
		['panel', 'get'],
	])('rejects with the %s read error and closes the connection', async (_store, method) => {
		await seedLegacyDb({ datasets: [{ id: 'ds-1' }], panel: {} });
		const error = new DOMException('read failed', 'UnknownError');
		vi.spyOn(globalThis.IDBObjectStore.prototype, method).mockImplementation(() => failingRequest(error));
		const close = vi.spyOn(globalThis.IDBDatabase.prototype, 'close');

		await expect(readLegacyState()).rejects.toBe(error);
		expect(close).toHaveBeenCalledTimes(1);
	});
});

describe('deleteLegacyState', () => {
	it('deletes the legacy database', async () => {
		await seedLegacyDb({ datasets: [{ id: 'ds-1' }] });

		await expect(deleteLegacyState()).resolves.toEqual({ ok: true });
		expect(await legacyDbNames()).toEqual([]);
	});

	it('reports blocked while another connection holds the database', async () => {
		await seedLegacyDb({ datasets: [] });
		const holder = await request(() => indexedDB.open(LEGACY_DB_NAME));

		try {
			await expect(deleteLegacyState()).resolves.toEqual({ ok: false, reason: 'blocked' });
		} finally {
			holder.close();
		}
	});

	it('reports an error instead of rejecting', async () => {
		vi.spyOn(indexedDB, 'deleteDatabase').mockImplementation(() => failingRequest());

		await expect(deleteLegacyState()).resolves.toEqual({ ok: false, reason: 'error' });
	});

	it('reports unavailable without IndexedDB', async () => {
		vi.stubGlobal('indexedDB', undefined);

		await expect(deleteLegacyState()).resolves.toEqual({ ok: false, reason: 'unavailable' });
	});
});

describe('legacy migration marker', () => {
	it('reads back as set only after it is written', () => {
		expect(hasLegacyMigrationMarker()).toBe(false);

		setLegacyMigrationMarker();

		expect(hasLegacyMigrationMarker()).toBe(true);
		expect(localStorage.getItem('chive.migrated')).toBe('1');
	});

	it('treats an unreadable or unwritable localStorage as unset', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('denied', 'SecurityError'); });
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });

		expect(() => setLegacyMigrationMarker()).not.toThrow();
		expect(hasLegacyMigrationMarker()).toBe(false);
	});
});
