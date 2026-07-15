/**
 * Persistence error normalization and i18n message-key mapping.
 *
 * `errorFrom` / `namedError` are internal builders used by the lifecycle
 * functions; the two `get*MessageKey` functions are public and pick the
 * translation key shown to the user for save/import failures.
 */

/** @internal Named error identities for project import failures. */
export const PROJECT_IMPORT_ERROR_NAMES = Object.freeze({
	EMPTY_FILE: 'EmptyProjectFileError',
	EMPTY_PROJECT: 'EmptyProjectImportError',
	UNSUPPORTED_FILE: 'UnsupportedProjectFileError',
	WORK_ONLY: 'WorkOnlyProjectImportError',
});

/**
 * Coerce an arbitrary thrown value into an Error, preserving `name` when
 * present so quota/import classification still works.
 *
 * @internal
 * @param {*} value
 * @param {string} [fallbackMessage='Persistence failed']
 * @returns {Error}
 */
export function errorFrom(value, fallbackMessage = 'Persistence failed') {
	if (value instanceof Error) return value;
	const error = new Error(String(value?.message || value || fallbackMessage));
	if (value?.name) error.name = value.name;
	return error;
}

/**
 * @internal
 * @param {string} name
 * @param {string} message
 * @returns {Error}
 */
export function namedError(name, message) {
	const error = new Error(message);
	error.name = name;
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

/**
 * Translation key for an import failure.
 *
 * @param {Error | null | undefined} error
 * @returns {string}
 */
export function getProjectImportErrorMessageKey(error) {
	if (isQuotaError(error)) return 'chive-save-failed-quota';
	if (error?.name === PROJECT_IMPORT_ERROR_NAMES.WORK_ONLY) return 'chive-project-import-work-only-error';
	if (error?.name === PROJECT_IMPORT_ERROR_NAMES.EMPTY_FILE) return 'chive-project-import-empty-file-error';
	if (error?.name === PROJECT_IMPORT_ERROR_NAMES.EMPTY_PROJECT) return 'chive-project-import-empty-project-error';
	const message = String(error?.message || '').toLowerCase();
	if (
		error?.name === PROJECT_IMPORT_ERROR_NAMES.UNSUPPORTED_FILE
		|| message.includes('unsupported chive sqlite')
		|| message.includes('missing chive sqlite')
		|| message.includes('deserialize failed')
		|| message.includes('no such table: meta')
	) {
		return 'chive-project-import-invalid-error';
	}
	return 'chive-project-import-error';
}
