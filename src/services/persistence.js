/**
 * CHIVE persistence service (public facade).
 *
 * Project content is stored as a SQLite database serialized to one IndexedDB
 * byte image. UI preferences stay in localStorage and are written immediately
 * on their own state events. Saves are automatic: callers wire the debounced
 * auto-save controller returned by {@link enablePersistenceAutoSave}.
 *
 * The implementation lives in the `persistence/` folder, split by
 * responsibility: lifecycle and snapshot normalization at the package root,
 * the storage backends under `persistence/backends/`, and the SQLite schema
 * and snapshot SQL under `persistence/sqlite/`. This file is the single public
 * entry point; a lint boundary keeps the internals unreachable from the rest
 * of `src/`, except `workers/persistWorker.js`, which hosts the blob backend.
 */

export { PROJECT_FILE_EXTENSION, PROJECT_FILE_MIME } from './persistence/projectFile.js';
export {
	configurePersistenceBackend,
	isPersistenceAvailable,
	hydrateState,
	persistState,
	exportProject,
	importProjectBytes,
	clearPersistedState,
} from './persistence/lifecycle.js';
export { getPersistenceErrorMessageKey, getProjectImportErrorMessageKey } from './persistence/errors.js';
export { isProjectDirtyEvent } from './persistence/dirtyTracking.js';
export { enablePersistenceAutoSave } from './persistence/autoSave.js';
