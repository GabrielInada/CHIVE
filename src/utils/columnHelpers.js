/**
 * CHIVE column-classification helpers. Pure functions over `columns`
 * arrays. Used by chart controls, services, and components.
 *
 * @typedef {import('../types.js').Dataset} Dataset
 * @typedef {import('../types.js').ColumnSpec} ColumnSpec
 */

/**
 * Get columns visible based on selection and dataset columns.
 *
 * @param {Dataset} dataset
 * @param {string[]} [selectedNames] - Override `dataset.selectedColumns`. Useful for previewing a hypothetical selection.
 * @returns {ColumnSpec[]} Subset of `dataset.columns` whose `name` appears in the resolved selection.
 */
export function filterVisibleColumns(dataset, selectedNames) {
	const nomesSelecionados = selectedNames || (
		Array.isArray(dataset.selectedColumns)
			? dataset.selectedColumns
			: dataset.columns.map(coluna => coluna.name)
	);
	return dataset.columns.filter(coluna => nomesSelecionados.includes(coluna.name));
}

/**
 * Numeric columns only.
 *
 * @param {ColumnSpec[]} columns
 * @returns {ColumnSpec[]}
 */
export function getNumericColumns(columns) {
	return columns.filter(coluna => coluna.type === 'number');
}

/**
 * Names of numeric columns.
 *
 * @param {ColumnSpec[]} columns
 * @returns {string[]}
 */
export function getNumericColumnNames(columns) {
	return getNumericColumns(columns).map(coluna => coluna.name);
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
	return columns.filter(coluna => coluna.type !== 'number');
}

/**
 * Names of categorical columns.
 *
 * @param {ColumnSpec[]} columns
 * @returns {string[]}
 */
export function getCategoricalColumnNames(columns) {
	return getCategoricalColumns(columns).map(coluna => coluna.name);
}

/**
 * Date columns only.
 *
 * @param {ColumnSpec[]} columns
 * @returns {ColumnSpec[]}
 */
export function getDateColumns(columns) {
	return columns.filter(coluna => coluna.type === 'date');
}

/**
 * Names of date columns.
 *
 * @param {ColumnSpec[]} columns
 * @returns {string[]}
 */
export function getDateColumnNames(columns) {
	return getDateColumns(columns).map(coluna => coluna.name);
}
