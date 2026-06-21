/**
 * Project file identity and naming.
 *
 * The `.chive.sqlite3` extension and MIME type are public (consumed by the
 * export/import UI); `buildProjectFileName` is internal to the facade.
 */

export const PROJECT_FILE_EXTENSION = '.chive.sqlite3';
export const PROJECT_FILE_MIME = 'application/vnd.chive.project+sqlite3';

/**
 * Build a timestamped download name for an exported project.
 *
 * @internal
 * @param {{ workOnly?: boolean }} [options]
 * @returns {string}
 */
export function buildProjectFileName({ workOnly = false } = {}) {
	const stamp = new Date().toISOString()
		.replace(/\.\d{3}Z$/, 'Z')
		.replace(/[:]/g, '-');
	const suffix = workOnly ? '-work-only' : '';
	return `chive-project${suffix}-${stamp}${PROJECT_FILE_EXTENSION}`;
}
