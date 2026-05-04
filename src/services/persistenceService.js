/**
 * CHIVE Persistence Service
 *
 * Saves application state to IndexedDB on a debounced wildcard subscription
 * and restores it on boot. UI preferences live in localStorage (small payload,
 * no transaction overhead, matches the existing locale pattern).
 *
 * Schema — DB `chive-state` v1:
 *   - `datasets` (keyPath: 'id')      — one record per dataset
 *   - `panel`    (keyPath: 'key')     — singleton record { key: 'singleton', ... }
 *
 * Caller injects `replaceAllState` and a `getState` function so this service
 * does not import from appState — keeps the dependency graph one-way and
 * makes the service trivially mockable.
 *
 * Cross-tab note: two tabs writing the same DB → last-writer-wins. Acceptable
 * for the current single-user / single-tab usage pattern.
 */

import { onStateChange, STATE_EVENTS } from '../modules/stateEvents.js';
import { debounce } from '../utils/debounce.js';

const DB_NAME = 'chive-state';
const DB_VERSION = 1;
const STORE_DATASETS = 'datasets';
const STORE_PANEL = 'panel';
const PANEL_KEY = 'singleton';
const UI_LOCAL_STORAGE_KEY = 'chive.ui';

// Coalesce save bursts beyond what debounce already does — if a previous
// save is still in flight when a new one fires, drop the new one. The next
// state event (or beforeunload flush) will write the latest snapshot.
let saveInFlight = null;

export function isPersistenceAvailable() {
	try {
		return typeof indexedDB !== 'undefined' && indexedDB !== null;
	} catch {
		return false;
	}
}

function openDb() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE_DATASETS)) {
				db.createObjectStore(STORE_DATASETS, { keyPath: 'id' });
			}
			if (!db.objectStoreNames.contains(STORE_PANEL)) {
				db.createObjectStore(STORE_PANEL, { keyPath: 'key' });
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

function readAllDatasets(db) {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_DATASETS, 'readonly');
		const store = tx.objectStore(STORE_DATASETS);
		const req = store.getAll();
		req.onsuccess = () => resolve(req.result || []);
		req.onerror = () => reject(req.error);
	});
}

function readPanel(db) {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_PANEL, 'readonly');
		const store = tx.objectStore(STORE_PANEL);
		const req = store.get(PANEL_KEY);
		req.onsuccess = () => resolve(req.result || null);
		req.onerror = () => reject(req.error);
	});
}

function writeAll(db, datasets, panelRecord) {
	return new Promise((resolve, reject) => {
		const tx = db.transaction([STORE_DATASETS, STORE_PANEL], 'readwrite');
		const dsStore = tx.objectStore(STORE_DATASETS);
		const panelStore = tx.objectStore(STORE_PANEL);

		dsStore.clear();
		datasets.forEach(dataset => {
			if (dataset && dataset.id) dsStore.put(dataset);
		});

		panelStore.put({ key: PANEL_KEY, ...panelRecord });

		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error);
	});
}

function readUiPrefs() {
	try {
		const raw = localStorage.getItem(UI_LOCAL_STORAGE_KEY);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

function writeUiPrefs(ui) {
	try {
		localStorage.setItem(UI_LOCAL_STORAGE_KEY, JSON.stringify(ui));
	} catch {
		// Quota exceeded or sandboxed — nothing actionable from here.
	}
}

/**
 * Restore persisted state into appState. No-op on first visit.
 * @param {Object} hooks
 * @param {Function} hooks.replaceAllState - mutates appState in place + emits STATE_HYDRATED
 * @param {Function} [hooks.transformPanel] - optional hook to migrate/upgrade the panel record
 *   (e.g. re-merging chart spec configs against current chartDefaults to absorb new keys)
 */
export async function hydrateState({ replaceAllState, transformPanel } = {}) {
	if (!isPersistenceAvailable() || typeof replaceAllState !== 'function') return;

	let db;
	try {
		db = await openDb();
	} catch (err) {
		console.warn('[chive:persist] could not open IndexedDB:', err);
		return;
	}

	let datasets = [];
	let panelRecord = null;
	try {
		[datasets, panelRecord] = await Promise.all([
			readAllDatasets(db),
			readPanel(db),
		]);
	} catch (err) {
		console.warn('[chive:persist] could not read persisted state:', err);
		db.close();
		return;
	}
	db.close();

	const ui = readUiPrefs();
	if (datasets.length === 0 && !panelRecord && !ui) return;

	const activeId = panelRecord?.activeDatasetId || null;
	const activeIndex = activeId
		? datasets.findIndex(dataset => dataset.id === activeId)
		: -1;

	let panel = null;
	if (panelRecord) {
		const { key, activeDatasetId, ...rest } = panelRecord;
		panel = rest;
		if (typeof transformPanel === 'function') {
			try {
				panel = transformPanel(panel) || panel;
			} catch (err) {
				console.warn('[chive:persist] transformPanel failed; using raw record:', err);
			}
		}
	}

	replaceAllState({
		data: { datasets, activeIndex },
		panel,
		ui,
	});
}

/**
 * Persist a state snapshot. Returns the in-flight save Promise.
 * Concurrent calls during an in-flight save are coalesced — the next call
 * after settle will pick up the latest snapshot.
 */
export async function persistState(snapshot) {
	if (!isPersistenceAvailable() || !snapshot || typeof snapshot !== 'object') return;

	const datasets = Array.isArray(snapshot.data?.datasets) ? snapshot.data.datasets : [];
	const activeIdx = Number.isInteger(snapshot.data?.activeIndex) ? snapshot.data.activeIndex : -1;
	const activeDataset = activeIdx >= 0 ? datasets[activeIdx] : null;
	const activeDatasetId = activeDataset?.id || null;

	const panel = snapshot.panel || {};
	const panelRecord = {
		blocks: Array.isArray(panel.blocks) ? panel.blocks : [],
		charts: Array.isArray(panel.charts) ? panel.charts : [],
		slots: panel.slots && typeof panel.slots === 'object' ? panel.slots : {},
		layout: typeof panel.layout === 'string' ? panel.layout : 'layout-2col',
		nextBlockId: Number.isInteger(panel.nextBlockId) ? panel.nextBlockId : 1,
		nextChartId: Number.isInteger(panel.nextChartId) ? panel.nextChartId : 0,
		activeDatasetId,
	};

	const ui = snapshot.ui || {};

	if (saveInFlight) return saveInFlight;

	saveInFlight = (async () => {
		let db;
		try {
			db = await openDb();
			await writeAll(db, datasets, panelRecord);
			writeUiPrefs(ui);
		} catch (err) {
			console.warn('[chive:persist] save failed:', err);
		} finally {
			if (db) db.close();
			saveInFlight = null;
		}
	})();

	return saveInFlight;
}

export async function clearPersistedState() {
	try {
		localStorage.removeItem(UI_LOCAL_STORAGE_KEY);
	} catch {
		// ignore
	}

	if (!isPersistenceAvailable()) return;

	return new Promise(resolve => {
		const req = indexedDB.deleteDatabase(DB_NAME);
		req.onsuccess = () => resolve();
		req.onerror = () => resolve(); // best-effort
		req.onblocked = () => resolve();
	});
}

/**
 * Subscribe to wildcard state events and persist a debounced snapshot.
 * Returns control handles so callers can flush on `beforeunload`.
 *
 * Wildcard subscription is OK here: per ARCHITECTURE.md §7, the wildcard slot
 * is reserved for state-bus consumers (stateSync, persistenceService). UI code
 * still subscribes only to typed events.
 */
export function enablePersistenceAutoSave(getStateFn, { debounceMs = 300 } = {}) {
	const noop = { flush: () => {}, cancel: () => {} };
	if (!isPersistenceAvailable() || typeof getStateFn !== 'function') return noop;

	const save = debounce(() => persistState(getStateFn()), debounceMs);

	const unsubscribe = onStateChange(STATE_EVENTS.WILDCARD, payload => {
		// Skip our own hydration emission — otherwise we'd schedule a save
		// for the snapshot we just loaded.
		if (payload?.type === STATE_EVENTS.STATE_HYDRATED) return;
		save();
	});

	return {
		flush: () => save.flush(),
		cancel: () => save.cancel(),
		unsubscribe,
	};
}
