/**
 * CHIVE persistence service.
 *
 * Project content is stored as a SQLite database serialized to one IndexedDB
 * byte image. UI preferences stay in localStorage and are written immediately
 * on their own state events. Saves are automatic: callers wire the debounced
 * auto-save controller returned by {@link enablePersistenceAutoSave}.
 *
 * @typedef {import('../types.js').AppState} AppState
 * @typedef {import('../types.js').UnsubscribeFn} UnsubscribeFn
 */

import { onStateChange, STATE_EVENTS } from '../modules/state/stateEvents.js';
import { debounce } from '../utils/debounce.js';
import { workerBackend } from './persistence/workerBackend.js';
import {
	deleteLegacyState,
	hasLegacyMigrationMarker,
	readLegacyState,
	setLegacyMigrationMarker,
} from './persistence/legacyIndexedDbReader.js';

const UI_LOCAL_STORAGE_KEY = 'chive.ui';

// The worker backend runs SQLite off the main thread. It does NOT statically
// import sqlite, so this default keeps SQLite-WASM off the boot/main bundle
// (it loads in the worker chunk, or via the worker backend's dynamic-import
// fallback only when a worker is unavailable).
let activeBackend = workerBackend;

/**
 * Swap the storage backend. Used by tests and future storage strategies.
 *
 * @param {{ available: () => boolean, hydrate: () => Promise<*>, persist: (snapshot: Partial<AppState>) => Promise<void>, clear: () => Promise<void> } | null} backend
 */
export function configurePersistenceBackend(backend) {
	activeBackend = backend || workerBackend;
}

/**
 * @returns {boolean} `true` when the active project backend can persist.
 */
export function isPersistenceAvailable() {
	try {
		return Boolean(activeBackend?.available?.());
	} catch {
		return false;
	}
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
		localStorage.setItem(UI_LOCAL_STORAGE_KEY, JSON.stringify(ui || {}));
	} catch {
		// Quota exceeded or sandboxed, nothing actionable from here.
	}
}

function isPlainObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Drop chart-spec entries that aren't plain objects; renderers read sub-keys
// and would explode on a string/number/array. Missing keys are absorbed later
// by mergeChartConfigWithDefaults.
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

// Drop records the renderers can't trust. Returns a sanitized copy or null
// when the record is unrecoverable.
function validateDatasetRecord(record) {
	if (!isPlainObject(record)) return null;
	if (!record.id) return null;
	if (typeof record.name !== 'string') return null;
	if (!Array.isArray(record.rows)) return null;
	if (!Array.isArray(record.columns)) return null;
	const columnsOk = record.columns.every(
		column => isPlainObject(column) && typeof column.name === 'string' && typeof column.type === 'string'
	);
	if (!columnsOk) return null;
	return {
		...record,
		selectedColumns: Array.isArray(record.selectedColumns) ? record.selectedColumns : [],
		chartConfig: sanitizeChartConfig(record.chartConfig),
	};
}

function normalizePanel(panelRecord, transformPanel) {
	if (!panelRecord) return null;
	if (!isPlainObject(panelRecord)) return null;
	let panel = { ...panelRecord };
	delete panel.key;
	delete panel.activeDatasetId;
	if (typeof transformPanel === 'function') {
		try {
			panel = transformPanel(panel) || panel;
		} catch (err) {
			console.warn('[chive:persist] transformPanel failed; using raw record:', err);
		}
	}
	return panel;
}

function normalizeStoredSnapshot(storedSnapshot, { transformPanel } = {}) {
	const rawDatasets = Array.isArray(storedSnapshot?.data?.datasets)
		? storedSnapshot.data.datasets
		: [];
	const rawCount = rawDatasets.length;
	const datasets = rawDatasets.map(validateDatasetRecord).filter(Boolean);
	if (datasets.length < rawCount) {
		console.warn(`[chive:persist] dropped ${rawCount - datasets.length} malformed dataset record(s) at hydrate`);
	}

	const activeId = storedSnapshot?.data?.activeDatasetId || null;
	const activeIndex = activeId
		? datasets.findIndex(dataset => dataset.id === activeId)
		: -1;

	return {
		data: {
			datasets,
			activeIndex,
		},
		panel: normalizePanel(storedSnapshot?.panel, transformPanel),
	};
}

function hasHydratableState(snapshot, ui) {
	return Boolean(
		snapshot?.data?.datasets?.length
		|| snapshot?.panel
		|| ui
	);
}

function errorFrom(value, fallbackMessage = 'Persistence failed') {
	if (value instanceof Error) return value;
	const error = new Error(String(value?.message || value || fallbackMessage));
	if (value?.name) error.name = value.name;
	return error;
}

function isQuotaError(error) {
	return error?.name === 'QuotaExceededError'
		|| String(error?.message || '').toLowerCase().includes('quota');
}

/**
 * Translation key for a save failure.
 *
 * @param {Error | null | undefined} error
 * @returns {string}
 */
export function getPersistenceErrorMessageKey(error) {
	return isQuotaError(error) ? 'chive-save-failed-quota' : 'chive-save-failed';
}

async function importLegacyStateIfNeeded() {
	if (hasLegacyMigrationMarker()) return null;

	let shouldMarkMigrated = false;
	try {
		const legacySnapshot = await readLegacyState();
		if (!legacySnapshot) {
			shouldMarkMigrated = true;
			return null;
		}

		const normalized = normalizeStoredSnapshot(legacySnapshot);
		const result = await persistState({
			data: normalized.data,
			panel: normalized.panel,
			ui: {},
		});
		if (result.ok) {
			await deleteLegacyState();
			shouldMarkMigrated = true;
		} else {
			console.warn('[chive:persist] legacy import could not be written to SQLite:', result.error);
		}
		return legacySnapshot;
	} catch (err) {
		console.warn('[chive:persist] legacy import failed:', err);
		return null;
	} finally {
		if (shouldMarkMigrated) setLegacyMigrationMarker();
	}
}

/**
 * Restore persisted state into appState. No-op on first visit, when storage is
 * unavailable, or when `replaceAllState` is not a function.
 *
 * @param {Object} hooks
 * @param {(snapshot: Partial<AppState>) => void} hooks.replaceAllState
 * @param {(panel: Object) => Object} [hooks.transformPanel]
 * @returns {Promise<void>}
 */
export async function hydrateState({ replaceAllState, transformPanel } = {}) {
	if (typeof replaceAllState !== 'function') return;

	let storedSnapshot = null;
	if (isPersistenceAvailable()) {
		try {
			storedSnapshot = await activeBackend.hydrate();
		} catch (err) {
			console.warn('[chive:persist] could not read SQLite persistence:', err);
			return;
		}
	}

	if (!storedSnapshot && isPersistenceAvailable()) {
		storedSnapshot = await importLegacyStateIfNeeded();
	}

	const ui = readUiPrefs();
	if (!storedSnapshot && !ui) return;

	const normalized = normalizeStoredSnapshot(storedSnapshot, { transformPanel });
	if (!hasHydratableState(normalized, ui)) return;

	replaceAllState({
		data: normalized.data,
		panel: normalized.panel,
		ui,
	});
}

/**
 * Persist a state snapshot to the active project backend.
 *
 * @param {Partial<AppState>} snapshot
 * @returns {Promise<{ ok: boolean, error?: Error }>}
 */
export async function persistState(snapshot) {
	if (!snapshot || typeof snapshot !== 'object') {
		return { ok: false, error: new Error('No state snapshot was provided') };
	}
	if (!isPersistenceAvailable()) {
		return { ok: false, error: new Error('IndexedDB is unavailable') };
	}

	try {
		await activeBackend.persist(snapshot);
		return { ok: true };
	} catch (err) {
		const error = errorFrom(err);
		console.warn('[chive:persist] save failed:', error);
		return { ok: false, error };
	}
}

/**
 * Wipe all persisted project state and UI prefs. The selected locale is not
 * touched. The legacy migration tombstone is set even if old-IDB deletion is
 * blocked by another tab.
 *
 * @returns {Promise<void>}
 */
export async function clearPersistedState() {
	try {
		localStorage.removeItem(UI_LOCAL_STORAGE_KEY);
	} catch {
		// ignore
	}
	setLegacyMigrationMarker();

	await Promise.all([
		(activeBackend?.clear?.() || Promise.resolve()).catch(() => {}),
		deleteLegacyState().catch(() => {}),
	]);
}

/**
 * True when a config update only changes the UI tab marker.
 *
 * @param {*} payload
 * @returns {boolean}
 */
export function isActiveTabOnlyPatch(payload) {
	if (!isPlainObject(payload)) return false;
	const keys = Object.keys(payload);
	return keys.length === 1 && Object.prototype.hasOwnProperty.call(payload, 'activeTab');
}

function isUiPrefsEvent(eventType) {
	return eventType === STATE_EVENTS.SIDEBAR_MODE_CHANGED
		|| eventType === STATE_EVENTS.PREVIEW_ROWS_CHANGED;
}

/**
 * Classify state events for project dirty tracking.
 *
 * @param {{ type: string, data?: * }} event
 * @returns {boolean}
 */
export function isProjectDirtyEvent(event) {
	if (!event?.type) return false;
	if (event.type === STATE_EVENTS.STATE_HYDRATED) return false;
	if (isUiPrefsEvent(event.type)) return false;
	if (event.type === STATE_EVENTS.CONFIG_UPDATED && isActiveTabOnlyPatch(event.data)) return false;
	return true;
}

function saveUiPrefsFromState(getStateFn) {
	try {
		writeUiPrefs(getStateFn()?.ui || {});
	} catch {
		// Ignore broken state access; project save will report real failures.
	}
}

function createNoopController() {
	const error = new Error('Persistence controller requires a getState function');
	return {
		saveNow: () => Promise.resolve({ ok: false, error }),
		dispose: () => {},
		getStatus: () => ({
			dirty: false,
			saving: false,
			lastSavedAt: null,
			lastError: null,
		}),
	};
}

/**
 * Subscribe to state changes and auto-save the project on a debounced timer.
 *
 * Each save re-exports the whole SQLite image, heavier than the old
 * structured-clone write, so edits are coalesced over a wide quiet window
 * before a save fires. `saveNow` keeps the coalescing/`rev` correctness so a
 * mid-save edit is never lost.
 *
 * @param {() => Partial<AppState>} getStateFn
 * @param {{ debounceMs?: number, onSaveError?: (error: Error, result: Object) => void }} [options]
 * @returns {{ saveNow: () => Promise<{ ok: boolean, error?: Error, skipped?: boolean }>, dispose: () => void, getStatus: () => Object, unsubscribe?: UnsubscribeFn }}
 */
export function enablePersistenceAutoSave(getStateFn, { debounceMs = 2000, onSaveError } = {}) {
	if (typeof getStateFn !== 'function') return createNoopController();

	let dirty = false;
	let rev = 0;
	let saveInFlight = null;
	let lastSavedAt = null;
	let lastError = null;
	let disposed = false;

	function getStatus() {
		return {
			dirty,
			saving: Boolean(saveInFlight),
			lastSavedAt,
			lastError,
		};
	}

	function saveNow() {
		if (saveInFlight) return saveInFlight;
		if (!dirty) return Promise.resolve({ ok: true, skipped: true });

		const revAtStart = rev;
		let ok = false;
		lastError = null;

		saveInFlight = (async () => {
			try {
				const result = await persistState(getStateFn());
				ok = result.ok;
				if (result.ok) {
					lastSavedAt = new Date().toISOString();
					if (rev === revAtStart) dirty = false;
				} else {
					lastError = errorFrom(result.error);
					if (typeof onSaveError === 'function') onSaveError(lastError, result);
				}
				return result;
			} catch (err) {
				lastError = errorFrom(err);
				if (typeof onSaveError === 'function') onSaveError(lastError, { ok: false, error: lastError });
				return { ok: false, error: lastError };
			}
		})().finally(() => {
			saveInFlight = null;
			// A mid-save edit bumped rev and left dirty set, save the newer
			// snapshot now that saveInFlight is nulled.
			if (ok && dirty && !disposed) {
				void saveNow();
			}
		});

		return saveInFlight;
	}

	const scheduleSave = debounce(() => { void saveNow(); }, debounceMs);

	const unsubscribe = onStateChange(STATE_EVENTS.WILDCARD, event => {
		if (isUiPrefsEvent(event?.type)) {
			saveUiPrefsFromState(getStateFn);
		}

		if (!isProjectDirtyEvent(event)) return;
		dirty = true;
		rev += 1;
		lastError = null;
		scheduleSave();
	});

	// Opportunistic close-net: flush a pending debounce when the tab hides or
	// closes. Best-effort only (MDN: unload-tied IndexedDB writes are not
	// guaranteed to complete), so there is no native unsaved-changes prompt.
	function flushPendingSave() {
		scheduleSave.cancel();
		if (dirty) void saveNow();
	}

	function handleVisibilityChange() {
		if (document.visibilityState === 'hidden') flushPendingSave();
	}

	if (typeof document !== 'undefined') {
		document.addEventListener('visibilitychange', handleVisibilityChange);
	}
	if (typeof window !== 'undefined') {
		window.addEventListener('pagehide', flushPendingSave);
	}

	return {
		saveNow,
		dispose: () => {
			disposed = true;
			scheduleSave.cancel();
			unsubscribe();
			if (typeof window !== 'undefined') {
				window.removeEventListener('pagehide', flushPendingSave);
			}
			if (typeof document !== 'undefined') {
				document.removeEventListener('visibilitychange', handleVisibilityChange);
			}
		},
		getStatus,
		unsubscribe,
	};
}
