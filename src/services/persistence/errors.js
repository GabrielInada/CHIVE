/**
 * Persistence error normalization and i18n message-key mapping.
 *
 * `errorFrom` / `namedError` are internal builders used by the lifecycle
 * functions; the two `get*MessageKey` functions are public and pick the
 * translation key shown to the user for save/import failures, and
 * `getPersistenceErrorMessageParams` supplies a save message's parameters.
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

/** @internal Name of the error raised when a payload cannot be held in one string. */
export const PAYLOAD_TOO_LARGE_ERROR_NAME = 'PayloadTooLargeError';

/**
 * Whether a serialization failure means the text exceeded the engine's
 * maximum string length: V8 and JavaScriptCore throw a `RangeError`, Firefox
 * an `InternalError`.
 *
 * @internal
 * @param {unknown} error
 * @returns {boolean}
 */
export function isStringLimitError(error) {
	return error instanceof RangeError || error?.name === 'RangeError' || error?.name === 'InternalError';
}

/**
 * The part of a payload that could not be saved, read defensively because it
 * crosses the persistence worker boundary.
 *
 * @internal
 * @param {unknown} value
 * @returns {{ kind: 'dataset' | 'chart', name: string } | null}
 */
export function readTooLargeOwner(value) {
	if (!value || typeof value !== 'object') return null;
	const kind = value.kind === 'chart' ? 'chart' : 'dataset';
	return { kind, name: typeof value.name === 'string' ? value.name.slice(0, 200) : '' };
}

/**
 * Error for a dataset or saved chart whose rows are too large to serialize.
 * Its message carries no user data; the owner's name travels in `tooLarge`
 * so the save failure can name it.
 *
 * @internal
 * @param {{ kind: 'dataset' | 'chart', name?: string }} owner
 * @returns {Error & { tooLarge: { kind: 'dataset' | 'chart', name: string } }}
 */
export function payloadTooLargeError(owner) {
	const tooLarge = readTooLargeOwner(owner);
	const error = namedError(
		PAYLOAD_TOO_LARGE_ERROR_NAME,
		tooLarge.kind === 'chart' ? 'A saved chart is too large to save' : 'A dataset is too large to save',
	);
	error.tooLarge = tooLarge;
	return error;
}

const TOO_LARGE_MESSAGE_KEYS = Object.freeze({
	dataset: 'chive-save-failed-dataset-too-large',
	chart: 'chive-save-failed-chart-too-large',
});

function tooLargeOwnerOf(error) {
	if (error?.name !== PAYLOAD_TOO_LARGE_ERROR_NAME) return null;
	const owner = readTooLargeOwner(error.tooLarge);
	return owner?.name ? owner : null;
}

function isQuotaError(error) {
	return error?.name === 'QuotaExceededError'
		|| String(error?.message || '').toLowerCase().includes('quota');
}

/**
 * Translation key for a save failure. A dataset or saved chart too large to
 * save gets its own message, which takes its name from
 * {@link getPersistenceErrorMessageParams}.
 *
 * @param {Error | null | undefined} error
 * @returns {string}
 */
export function getPersistenceErrorMessageKey(error) {
	const owner = tooLargeOwnerOf(error);
	if (owner) return TOO_LARGE_MESSAGE_KEYS[owner.kind];
	return isQuotaError(error) ? 'chive-save-failed-quota' : 'chive-save-failed';
}

/**
 * Parameters for the message {@link getPersistenceErrorMessageKey} picks: the
 * name of the dataset or saved chart that is too large to save, or none.
 *
 * @param {Error | null | undefined} error
 * @returns {string[]}
 */
export function getPersistenceErrorMessageParams(error) {
	const owner = tooLargeOwnerOf(error);
	return owner ? [owner.name] : [];
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
