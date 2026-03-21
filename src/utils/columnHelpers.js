/**
 * Get columns visible based on selection and dataset columns
 * @param {Object} dataset - Dataset object with colunas and colunasSelecionadas
 * @param {Array} [selectedNames] - Optional array of column names to use instead of dataset.colunasSelecionadas
 * @returns {Array} - Array of visible column objects
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
 * Filter numeric columns from a list
 * @param {Array} colunas - Array of column objects with tipo property
 * @returns {Array} - Column objects where tipo === 'numero'
 */
export function getNumericColumns(colunas) {
	return colunas.filter(coluna => coluna.tipo === 'numero');
}

/**
 * Filter numeric columns and return just their names
 * @param {Array} colunas - Array of column objects
 * @returns {Array} - Array of numeric column names
 */
export function getNumericColumnNames(colunas) {
	return getNumericColumns(colunas).map(coluna => coluna.nome);
}

/**
 * Filter categorical (non-numeric) columns from a list
 * @param {Array} colunas - Array of column objects with tipo property
 * @returns {Array} - Column objects where tipo !== 'numero'
 */
export function getCategoricalColumns(colunas) {
	return colunas.filter(coluna => coluna.tipo !== 'numero');
}

/**
 * Filter categorical columns and return just their names
 * @param {Array} colunas - Array of column objects
 * @returns {Array} - Array of categorical column names
 */
export function getCategoricalColumnNames(colunas) {
	return getCategoricalColumns(colunas).map(coluna => coluna.nome);
}
