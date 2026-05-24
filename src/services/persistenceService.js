/**
 * CHIVE Persistence Service.
 *
 * Saves application state to IndexedDB on a debounced wildcard subscription
 * and restores it on boot. UI preferences live in localStorage (small payload,
 * no transaction overhead, matches the existing locale pattern).
 *
 * Schema — DB `chive-state` v2:
 *   - `datasets` (keyPath: 'id')      — one record per dataset
 *   - `panel`    (keyPath: 'key')     — singleton record { key: 'singleton', ... }
 *
 * v1→v2 upgrade: drops both stores and clears localStorage UI prefs. The
 * field names changed shape in v2 (English: `name`/`rows`/`columns`/`type`
 * instead of `nome`/`dados`/`colunas`/`tipo`), and migrating in place is
 * not worth the complexity given how cheap re-uploading is. Existing users
 * re-upload once.
 *
 * Caller injects `replaceAllState` and a `getState` function so this service
 * does not import from appState — keeps the dependency graph one-way and
 * makes the service trivially mockable.
 *
 * Cross-tab note: two tabs writing the same DB → last-writer-wins. Acceptable
 * for the current single-user / single-tab usage pattern.
 *
 * @typedef {import('../types.js').AppState} AppState
 * @typedef {import('../types.js').UnsubscribeFn} UnsubscribeFn
 */

import { onStateChange, STATE_EVENTS } from '../modules/state/stateEvents.js';
import { debounce } from '../utils/debounce.js';

const DB_NAME = 'chive-state';
const DB_VERSION = 2;
const STORE_DATASETS = 'datasets';
const STORE_PANEL = 'panel';
const PANEL_KEY = 'singleton';
const UI_LOCAL_STORAGE_KEY = 'chive.ui';

// Coalesce save bursts beyond what debounce already does — if a previous
// save is still in flight when a new one fires, drop the new one. The next
// state event (or beforeunload flush) will write the latest snapshot.
let saveInFlight = null;

/**
 * @returns {boolean} `true` when `indexedDB` is reachable from the current context (browser with IndexedDB support, or jsdom with `fake-indexeddb` installed). Sandboxed contexts that throw on `indexedDB` access return `false`.
 */
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
		req.onupgradeneeded = (event) => {
			const db = req.result;
			// v1→v2: field names changed shape (English rename). Drop the
			// stores so old records don't fail validation and silently disappear.
			// Also clear localStorage so the persisted `sidebarMode: 'dados'`
			// value (renamed to `'data'`) doesn't leave the sidebar in an
			// unrendered state for existing users. Guarded by `oldVersion > 0`
			// so the first-visit case (oldVersion === 0) does not wipe state.
			if (event.oldVersion > 0 && event.oldVersion < 2) {
				if (db.objectStoreNames.contains(STORE_DATASETS)) {
					db.deleteObjectStore(STORE_DATASETS);
				}
				if (db.objectStoreNames.contains(STORE_PANEL)) {
					db.deleteObjectStore(STORE_PANEL);
				}
				try {
					localStorage.removeItem(UI_LOCAL_STORAGE_KEY);
				} catch {
					// Quota / sandboxed — best effort.
				}
			}
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

function isPlainObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Drop chart-spec entries that aren't plain objects — renderers read sub-keys
// (.color, .category, …) and would explode on a string/number/array. Missing
// keys are absorbed downstream by mergeChartConfigWithDefaults.
function sanitizeChartConfig(chartConfig) {
	if (!isPlainObject(chartConfig)) return {};
	const sanitized = {};
	for (const [chartKey, chartTypeConfig] of Object.entries(chartConfig)) {
		if (isPlainObject(chartTypeConfig)) {
			sanitized[chartKey] = chartTypeConfig;
		}
	}
	return sanitized;
}

// Drop records the renderers can't trust. Returns a (shallow) sanitized copy
// or null when the record is unrecoverable.
function validateDatasetRecord(record) {
	if (!isPlainObject(record)) return null;
	if (!record.id) return null;
	if (typeof record.name !== 'string') return null;
	if (!Array.isArray(record.rows)) return null;
	if (!Array.isArray(record.columns)) return null;
	const colunasOk = record.columns.every(
		col => isPlainObject(col) && typeof col.name === 'string' && typeof col.type === 'string'
	);
	if (!colunasOk) return null;
	return {
		...record,
		chartConfig: sanitizeChartConfig(record.chartConfig),
	};
}

/**
 * Restore persisted state into appState. No-op on first visit, when
 * IndexedDB is unavailable, or when `replaceAllState` is not a function.
 *
 * Dataset records that fail validation (missing `id`, malformed `columns`,
 * non-array `rows`, …) are dropped with a console warning; the remaining
 * datasets are still hydrated.
 *
 * @param {Object} hooks
 * @param {(snapshot: Partial<AppState>) => void} hooks.replaceAllState - Mutates appState in place + emits STATE_HYDRATED.
 * @param {(panel: Object) => Object} [hooks.transformPanel] - Optional migration hook. Receives the raw panel record (sans `key`/`activeDatasetId`); returns the upgraded one. A common use is re-merging chart spec configs against current `chartDefaults` to absorb newly-added keys.
 * @returns {Promise<void>}
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

	const rawCount = datasets.length;
	datasets = datasets.map(validateDatasetRecord).filter(Boolean);
	if (datasets.length < rawCount) {
		console.warn(`[chive:persist] dropped ${rawCount - datasets.length} malformed dataset record(s) at hydrate`);
	}

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
 * Persist a state snapshot to IndexedDB (datasets + panel singleton) and
 * UI prefs to localStorage. Returns the in-flight save Promise.
 *
 * Coalescing: if a previous save is still in flight when this is called,
 * the new call returns that previous Promise instead of starting another
 * write. The next state event (or `beforeunload` flush) will capture
 * whatever changed in the meantime — last-writer-wins semantics, by design.
 *
 * No-op when IndexedDB is unavailable or `snapshot` is not an object.
 *
 * @param {Partial<AppState>} snapshot
 * @returns {Promise<void>}
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
		layout: typeof panel.layout === 'string' ? panel.layout : 'template-2col',
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

/**
 * Wipe all persisted state — UI prefs from localStorage and the entire
 * IndexedDB database. Best-effort: resolves even if individual deletions
 * fail or are blocked by another tab.
 *
 * @returns {Promise<void>}
 */
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
 *
 * `STATE_HYDRATED` is skipped — saving the snapshot we just loaded would be
 * a no-op write at best and a race condition at worst.
 *
 * @param {() => Partial<AppState>} getStateFn - Snapshot accessor; usually `getState` from appState.
 * @param {{ debounceMs?: number }} [options]
 * @returns {{ flush: () => void, cancel: () => void, unsubscribe?: UnsubscribeFn }} When persistence is unavailable, returns no-op `flush`/`cancel` and omits `unsubscribe`.
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
