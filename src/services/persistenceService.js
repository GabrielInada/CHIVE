/**
 * CHIVE persistence service (public facade).
 *
 * Project content is stored as a SQLite database serialized to one IndexedDB
 * byte image. UI preferences stay in localStorage and are written immediately
 * on their own state events. Saves are automatic: callers wire the debounced
 * auto-save controller returned by {@link enablePersistenceAutoSave}.
 *
 * The implementation lives in the `persistenceService/` folder, split by
 * responsibility; this file is the single public entry point and keeps the
 * export surface stable for every consumer. The storage backends themselves
 * live in the sibling `persistence/` folder.
 */

export { PROJECT_FILE_EXTENSION, PROJECT_FILE_MIME } from './persistenceService/projectFile.js';
export {
	configurePersistenceBackend,
	isPersistenceAvailable,
	hydrateState,
	persistState,
	exportProject,
	importProjectBytes,
	clearPersistedState,
} from './persistenceService/lifecycle.js';
export { getPersistenceErrorMessageKey, getProjectImportErrorMessageKey } from './persistenceService/errors.js';
export { isActiveTabOnlyPatch, isProjectDirtyEvent } from './persistenceService/dirtyTracking.js';
export { enablePersistenceAutoSave } from './persistenceService/autoSave.js';
