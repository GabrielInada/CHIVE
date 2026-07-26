/**
 * Backend registry and project lifecycle.
 *
 * Owns the single mutable `activeBackend` and every function that reads or
 * writes it (configure, availability, hydrate, persist, export, import, clear,
 * legacy migration). Co-locating the singleton with its readers keeps backend
 * swapping correct: callers and the auto-save controller observe a swapped
 * backend through the live `persistState` binding without any accessor.
 *
 * @typedef {import('../../types.js').AppState} AppState
 */

import { workerBackend } from './backends/workerBackend.js';
import {
	deleteLegacyState,
	hasLegacyMigrationMarker,
	readLegacyState,
	setLegacyMigrationMarker,
} from './backends/legacyIndexedDbReader.js';
import {
	createEmptyPanelSnapshot,
	hasHydratableState,
	hasWorkOnlyDatasets,
	normalizeStoredSnapshot,
} from './snapshot.js';
import { errorFrom, namedError, PROJECT_IMPORT_ERROR_NAMES } from './errors.js';
import { buildProjectFileName } from './projectFile.js';
import { clearUiPrefs, readUiPrefs } from './uiPrefs.js';

// The worker backend runs SQLite off the main thread. It does NOT statically
// import sqlite, so this default keeps SQLite-WASM off the boot/main bundle
// (it loads in the worker chunk, or via the worker backend's dynamic-import
// fallback only when a worker is unavailable).
let activeBackend = workerBackend;

/**
 * Swap the storage backend. Used by tests and future storage strategies.
 *
 * @param {{ available: () => boolean, hydrate: () => Promise<*>, persist: (snapshot: Partial<AppState>) => Promise<void>, exportBytes?: (snapshot: Partial<AppState>, options?: { workOnly?: boolean }) => Promise<Uint8Array>, importBytes?: (bytes: Uint8Array | ArrayBuffer) => Promise<*>, clear: () => Promise<{ ok: boolean, reason?: string } | void> } | null} backend
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
 * @param {(error: unknown) => void} [hooks.onError]
 * @returns {Promise<void>}
 */
export async function hydrateState({ replaceAllState, transformPanel, onError } = {}) {
	if (typeof replaceAllState !== 'function') return;

	let storedSnapshot = null;
	if (isPersistenceAvailable()) {
		try {
			storedSnapshot = await activeBackend.hydrate();
		} catch (err) {
			console.warn('[chive:persist] could not read SQLite persistence:', err);
			if (typeof onError === 'function') onError(err);
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
 * Serialize the current project to SQLite bytes.
 *
 * @param {Partial<AppState>} snapshot
 * @param {{ workOnly?: boolean }} [options]
 * @returns {Promise<{ ok: boolean, bytes?: Uint8Array, fileName?: string, error?: Error }>}
 */
export async function exportProject(snapshot, { workOnly = false } = {}) {
	if (!snapshot || typeof snapshot !== 'object') {
		return { ok: false, error: new Error('No state snapshot was provided') };
	}
	if (!isPersistenceAvailable()) {
		return { ok: false, error: new Error('IndexedDB is unavailable') };
	}
	if (typeof activeBackend?.exportBytes !== 'function') {
		return { ok: false, error: new Error('Project export is unavailable') };
	}

	try {
		const bytes = await activeBackend.exportBytes(snapshot, { workOnly: Boolean(workOnly) });
		return {
			ok: true,
			bytes,
			fileName: buildProjectFileName({ workOnly: Boolean(workOnly) }),
		};
	} catch (err) {
		const error = errorFrom(err, 'Project export failed');
		console.warn('[chive:persist] project export failed:', error);
		return { ok: false, error };
	}
}

/**
 * Import a full CHIVE SQLite project, persist it as the current browser
 * project, then replace in-memory state. Work-only imports are intentionally
 * rejected in v1 because dataset re-linking semantics are not implemented.
 *
 * @param {Uint8Array | ArrayBuffer} bytes
 * @param {Object} hooks
 * @param {(snapshot: Partial<AppState>) => void} hooks.replaceAllState
 * @param {(panel: Object) => Object} [hooks.transformPanel]
 * @returns {Promise<{ ok: boolean, snapshot?: Partial<AppState>, error?: Error }>}
 */
export async function importProjectBytes(bytes, { replaceAllState, transformPanel } = {}) {
	if (typeof replaceAllState !== 'function') {
		return { ok: false, error: new Error('replaceAllState hook is required') };
	}
	if (!isPersistenceAvailable()) {
		return { ok: false, error: new Error('IndexedDB is unavailable') };
	}
	if (typeof activeBackend?.importBytes !== 'function') {
		return { ok: false, error: new Error('Project import is unavailable') };
	}

	try {
		const storedSnapshot = await activeBackend.importBytes(bytes);
		if (hasWorkOnlyDatasets(storedSnapshot)) {
			throw namedError(
				PROJECT_IMPORT_ERROR_NAMES.WORK_ONLY,
				'Work-only project imports are not supported yet',
			);
		}

		const normalized = normalizeStoredSnapshot(storedSnapshot, { transformPanel });
		if (!hasHydratableState(normalized, null)) {
			throw namedError(PROJECT_IMPORT_ERROR_NAMES.EMPTY_PROJECT, 'Project file does not contain importable data');
		}
		const importPanel = normalized.panel || createEmptyPanelSnapshot();

		const persistResult = await persistState({
			data: normalized.data,
			panel: importPanel,
			ui: {},
		});
		if (!persistResult.ok) {
			return { ok: false, error: errorFrom(persistResult.error, 'Project import save failed') };
		}

		replaceAllState({
			data: normalized.data,
			panel: importPanel,
		});
		return { ok: true, snapshot: { ...normalized, panel: importPanel } };
	} catch (err) {
		const error = errorFrom(err, 'Project import failed');
		console.warn('[chive:persist] project import failed:', error);
		return { ok: false, error };
	}
}

/**
 * Wipe all persisted project state and UI prefs. The selected locale is not
 * touched. The legacy migration tombstone is set even if old-IDB deletion is
 * blocked by another tab.
 *
 * Never rejects, but it does report failure. A deletion blocked by another tab
 * leaves the project database in place, and a caller that told the user their
 * data was removed would be lying; `blocked` is the outcome that a second open
 * tab produces, and it is actionable in a way a generic failure is not.
 *
 * The legacy database is best-effort and does not affect the reported outcome:
 * the tombstone above already prevents it from being read again.
 *
 * @returns {Promise<{ ok: boolean, reason?: 'blocked' | 'error' | 'unavailable' }>}
 */
export async function clearPersistedState() {
	clearUiPrefs();
	setLegacyMigrationMarker();

	const [projectOutcome] = await Promise.all([
		(activeBackend?.clear?.() || Promise.resolve({ ok: true }))
			.catch(error => ({ ok: false, reason: 'error', error })),
		deleteLegacyState().catch(() => ({ ok: false, reason: 'error' })),
	]);

	// A backend that resolves without an outcome predates the reporting contract;
	// treat a clean resolution as success rather than inventing a failure.
	if (!projectOutcome || projectOutcome.ok !== false) return { ok: true };
	return { ok: false, reason: projectOutcome.reason || 'error' };
}
