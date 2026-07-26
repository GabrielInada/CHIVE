/**
 * CHIVE column-classification helpers. Pure functions over `columns`
 * arrays. Used by state facades, render coordination, dataset and panel
 * features, the bubble chart, and persistence snapshots.
 *
 * @typedef {import('../../types.js').Dataset} Dataset
 * @typedef {import('../../types.js').ColumnSpec} ColumnSpec
 */

/**
 * Get columns visible based on selection and dataset columns.
 *
 * @param {Dataset} dataset
 * @param {string[]} [selectedNames] - Override `dataset.selectedColumns`. Useful for previewing a hypothetical selection.
 * @returns {ColumnSpec[]} Subset of `dataset.columns` whose `name` appears in the resolved selection.
 */
export function filterVisibleColumns(dataset, selectedNames) {
	const resolvedSelectedNames = selectedNames || (
		Array.isArray(dataset.selectedColumns)
			? dataset.selectedColumns
			: dataset.columns.map(column => column.name)
	);
	return dataset.columns.filter(column => resolvedSelectedNames.includes(column.name));
}

/**
 * Numeric columns only.
 *
 * @param {ColumnSpec[]} columns
 * @returns {ColumnSpec[]}
 */
export function getNumericColumns(columns) {
	return columns.filter(column => column.type === 'number');
}

/**
 * Names of numeric columns.
 *
 * @param {ColumnSpec[]} columns
 * @returns {string[]}
 */
export function getNumericColumnNames(columns) {
	return getNumericColumns(columns).map(column => column.name);
}

/**
 * Categorical (non-numeric) columns.
 *
 * Note: date columns are included here for backwards-compatibility with
 * bar/pie/treemap/scatter, they treat dates as categorical buckets. Use
 * {@link getDateColumns} when you want only date columns.
 *
 * @param {ColumnSpec[]} columns
 * @returns {ColumnSpec[]}
 */
export function getCategoricalColumns(columns) {
	return columns.filter(column => column.type !== 'number');
}

/**
 * Names of categorical columns.
 *
 * @param {ColumnSpec[]} columns
 * @returns {string[]}
 */
export function getCategoricalColumnNames(columns) {
	return getCategoricalColumns(columns).map(column => column.name);
}

/**
 * Normalize a list of candidate column names: drop non-string / empty entries,
 * de-duplicate (first occurrence wins), optionally keep only names present in
 * `allowed`, then hard-cap the length. Non-array input yields an empty array.
 *
 * @param {*} names - Candidate column names (any value; non-arrays yield `[]`).
 * @param {{ allowed?: Set<string> | null, max?: number }} [options]
 * @param {Set<string> | null} [options.allowed] - When set, keep only names it contains.
 * @param {number} [options.max=Infinity] - Hard length cap. Only explicit Infinity is uncapped; a finite value is floored to a non-negative integer; anything else (NaN, -Infinity) caps to nothing.
 * @returns {string[]}
 */
export function normalizeColumnNameList(names, { allowed = null, max = Infinity } = {}) {
	if (!Array.isArray(names)) return [];
	// Normalize the cap up front, fail-closed: only an explicit Infinity means
	// "uncapped"; a finite max is floored to a non-negative integer; anything
	// else (NaN, -Infinity) is an invalid limit and caps to nothing, so a bad
	// limit can never silently leave the list unbounded. (max === 0 must also
	// return [] — the break is checked after the push, so without the early
	// return a zero cap would still yield one item.)
	let limit;
	if (max === Infinity) {
		limit = Infinity;
	} else if (Number.isFinite(max)) {
		limit = Math.max(0, Math.floor(max));
	} else {
		limit = 0;
	}
	if (limit === 0) return [];
	const seen = new Set();
	const out = [];
	for (const name of names) {
		if (typeof name !== 'string' || name === '') continue;
		if (allowed && !allowed.has(name)) continue;
		if (seen.has(name)) continue;
		seen.add(name);
		out.push(name);
		if (out.length >= limit) break;
	}
	return out;
}

/**
 * Extract a dataset's column names, tolerant of the loose shapes that reach
 * state boundaries: `{ name }` column objects and bare strings both yield
 * names. Returns `undefined` when `dataset.columns` is not an array, so callers
 * can distinguish "no trustworthy column context" (skip filter trimming) from
 * "genuinely zero columns" (`[]`, trim everything).
 *
 * @param {Dataset | { columns?: * } | null | undefined} dataset
 * @returns {string[] | undefined}
 */
export function getDatasetColumnNames(dataset) {
	const columns = dataset?.columns;
	if (!Array.isArray(columns)) return undefined;
	// Reuse normalizeColumnNameList so name filtering + de-dup match the rest of
	// the codebase; the non-array guard above keeps "no context" distinct from [].
	return normalizeColumnNameList(
		columns.map(column => (typeof column === 'string' ? column : column?.name)),
		{ max: Infinity },
	);
}

/**
 * Date columns only.
 *
 * @param {ColumnSpec[]} columns
 * @returns {ColumnSpec[]}
 */
export function getDateColumns(columns) {
	return columns.filter(column => column.type === 'date');
}

/**
 * Names of date columns.
 *
 * @param {ColumnSpec[]} columns
 * @returns {string[]}
 */
export function getDateColumnNames(columns) {
	return getDateColumns(columns).map(column => column.name);
}
