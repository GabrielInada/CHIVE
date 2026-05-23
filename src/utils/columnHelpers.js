/**
 * CHIVE column-classification helpers. Pure functions over `colunas`
 * arrays. Used by chart controls, services, and components.
 *
 * @typedef {import('../types.js').Dataset} Dataset
 * @typedef {import('../types.js').ColumnSpec} ColumnSpec
 */

/**
 * Get columns visible based on selection and dataset columns.
 *
 * @param {Dataset} dataset
 * @param {string[]} [selectedNames] - Override `dataset.colunasSelecionadas`. Useful for previewing a hypothetical selection.
 * @returns {ColumnSpec[]} Subset of `dataset.colunas` whose `nome` appears in the resolved selection.
 */
export function filterVisibleColumns(dataset, selectedNames) {
	const nomesSelecionados = selectedNames || (
		Array.isArray(dataset.colunasSelecionadas)
			? dataset.colunasSelecionadas
			: dataset.colunas.map(coluna => coluna.nome)
	);
	return dataset.colunas.filter(coluna => nomesSelecionados.includes(coluna.nome));
}

/**
 * Numeric columns only.
 *
 * @param {ColumnSpec[]} colunas
 * @returns {ColumnSpec[]}
 */
export function getNumericColumns(colunas) {
	return colunas.filter(coluna => coluna.tipo === 'numero');
}

/**
 * Names of numeric columns.
 *
 * @param {ColumnSpec[]} colunas
 * @returns {string[]}
 */
export function getNumericColumnNames(colunas) {
	return getNumericColumns(colunas).map(coluna => coluna.nome);
}

/**
 * Categorical (non-numeric) columns.
 *
 * Note: date columns are included here for backwards-compatibility with
 * bar/pie/treemap/scatter — they treat dates as categorical buckets. Use
 * {@link getDateColumns} when you want only date columns.
 *
 * @param {ColumnSpec[]} colunas
 * @returns {ColumnSpec[]}
 */
export function getCategoricalColumns(colunas) {
	return colunas.filter(coluna => coluna.tipo !== 'numero');
}

/**
 * Names of categorical columns.
 *
 * @param {ColumnSpec[]} colunas
 * @returns {string[]}
 */
export function getCategoricalColumnNames(colunas) {
	return getCategoricalColumns(colunas).map(coluna => coluna.nome);
}

/**
 * Date columns only.
 *
 * @param {ColumnSpec[]} colunas
 * @returns {ColumnSpec[]}
 */
export function getDateColumns(colunas) {
	return colunas.filter(coluna => coluna.tipo === 'data');
}

/**
 * Names of date columns.
 *
 * @param {ColumnSpec[]} colunas
 * @returns {string[]}
 */
export function getDateColumnNames(colunas) {
	return getDateColumns(colunas).map(coluna => coluna.nome);
}
