/**
 * CHIVE File Manager
 * 
 * Handles file upload and dataset management:
 * - File selection and parsing
 * - Dataset add/remove/select
 * - File validation
 * - Row limit handling
 */

import { t } from '../services/i18nService.js';
import { parseCsv, parseJson, processData, formatFileSize, joinDatasets } from '../services/dataService.js';
import { addDataset, removeDataset, setActiveDataset, getAllDatasets } from './appState.js';
import { showError, clearErrors } from './feedbackUI.js';
import { FILE_SIZE_LIMIT_BYTES, ROW_LIMIT } from '../config/limits.js';
import { createDefaultChartConfig } from '../config/chartDefaults.js';

// Callback when dataset list changes
let onDatasetsChangeCallback = null;

/**
 * Initialize file manager
 * @param {Function} changeCallback - Called when dataset list changes
 */
export function initFileManager(changeCallback = null) {
	onDatasetsChangeCallback = changeCallback;
}

/**
 * Handle file selection (from input or drop)
 * @param {FileList} files - Files to process
 * @returns {Promise<void>}
 */
export async function handleFileUpload(files) {
	if (!files || files.length === 0) return;

	clearErrors();
	const filesToProcess = Array.from(files);

	for (const file of filesToProcess) {
		try {
			await processFileForDataset(file);
		} catch (err) {
			showError(err.message || t('chive-error-upload-processing'));
		}
	}

	if (onDatasetsChangeCallback) {
		onDatasetsChangeCallback();
	}
}

/**
 * Process a single file and add to datasets
 * @private
 */
async function processFileForDataset(file) {
	// Validate file format
	if (!file.name.match(/\.(csv|json)$/i)) {
		throw new Error(t('chive-error-format'));
	}

	// Check file size
	if (file.size > FILE_SIZE_LIMIT_BYTES) {
		const confirmarArquivoGrande = window.confirm(
			`${t('chive-warn-file-size', [file.name, formatFileSize(FILE_SIZE_LIMIT_BYTES)])} \n${t('chive-warn-file-size-proceed')}`
		);
		if (!confirmarArquivoGrande) {
			throw new Error(t('chive-error-cancelled'));
		}
	}

	// Read file
	const content = await readFile(file);
	let dadosBrutos;

	// Parse based on format
	try {
		if (file.name.endsWith('.csv')) {
			dadosBrutos = parseCsv(content);
		} else {
			dadosBrutos = parseJson(content);
		}
	} catch (err) {
		throw new Error(`${t('chive-error-parse')}: ${err.message}`);
	}

	// Check row limit
	if (dadosBrutos.length > ROW_LIMIT) {
		const confirmarLinhas = window.confirm(
			`${t('chive-warn-rows', [dadosBrutos.length, ROW_LIMIT])} \n${t('chive-warn-rows-proceed')}`
		);
		if (!confirmarLinhas) {
			throw new Error(t('chive-error-cancelled'));
		}
		dadosBrutos = dadosBrutos.slice(0, ROW_LIMIT);
	}

	// Process dataset and normalize to app shape
	const processado = processData(dadosBrutos, file.name);
	const dataset = {
		nome: file.name,
		tamanho: formatFileSize(file.size),
		dados: processado.dados,
		colunas: processado.colunas,
		colunasSelecionadas: processado.colunas.map(coluna => coluna.nome),
		configGraficos: createDefaultChartConfig(),
	};
	addDataset(dataset);
}

/**
 * Read file as text
 * @private
 */
function readFile(file) {
	return new Promise((resolve, reject) => {
		const leitor = new FileReader();
		leitor.onload = event => resolve(event.target.result);
		leitor.onerror = () => reject(new Error(t('chive-error-read', [file.name])));
		leitor.readAsText(file);
	});
}

/**
 * Select a dataset as active
 * @param {number} index - Dataset index
 */
export function selectDataset(index) {
	try {
		setActiveDataset(index);
		if (onDatasetsChangeCallback) {
			onDatasetsChangeCallback();
		}
	} catch (err) {
		showError(err.message);
	}
}

/**
 * Remove a dataset
 * @param {number} index - Dataset index
 */
export function removeDatasetByIndex(index) {
	try {
		removeDataset(index);
		if (onDatasetsChangeCallback) {
			onDatasetsChangeCallback();
		}
	} catch (err) {
		showError(err.message);
	}
}

/**
 * Get all loaded datasets
 * @returns {Array} Datasets
 */
export function getLoadedDatasets() {
	return getAllDatasets();
}

function buildJoinDatasetName(leftName, rightName) {
	const shorten = (value, max = 24) => {
		const text = String(value || '').trim();
		if (text.length <= max) return text;
		return `${text.slice(0, max - 1)}…`;
	};

	const leftBase = shorten(String(leftName || 'A').replace(/\.[^.]+$/, '')) || 'A';
	const rightBase = shorten(String(rightName || 'B').replace(/\.[^.]+$/, '')) || 'B';
	const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
	return `${t('chive-join-name-prefix')} ${leftBase} + ${rightBase} (${stamp})`;
}

function normalizeJoinType(value) {
	return ['inner', 'left', 'right', 'full'].includes(value) ? value : 'inner';
}

export function createJoinedDataset(spec = {}) {
	const datasets = getAllDatasets();
	if (datasets.length < 2) {
		return { ok: false, message: t('chive-join-error-min-files') };
	}

	const leftIndex = Number(spec.leftIndex);
	const rightIndex = Number(spec.rightIndex);
	if (Number.isNaN(leftIndex) || Number.isNaN(rightIndex) || !datasets[leftIndex] || !datasets[rightIndex]) {
		return { ok: false, message: t('chive-join-error-invalid-file-selection') };
	}

	if (leftIndex === rightIndex) {
		return { ok: false, message: t('chive-join-error-select-different-files') };
	}

	const leftDataset = datasets[leftIndex];
	const rightDataset = datasets[rightIndex];
	const leftKeys = Array.isArray(spec.leftKeys) ? spec.leftKeys.filter(Boolean) : [];
	const rightKeys = Array.isArray(spec.rightKeys) ? spec.rightKeys.filter(Boolean) : [];
	if (leftKeys.length === 0 || rightKeys.length === 0) {
		return { ok: false, message: t('chive-join-error-keys-required') };
	}

	if (leftKeys.length !== rightKeys.length) {
		return { ok: false, message: t('chive-join-error-key-count-mismatch') };
	}

	const leftColumns = Array.isArray(spec.leftColumns)
		? spec.leftColumns.filter(Boolean)
		: leftDataset.colunas.map(column => column.nome);
	const rightColumns = Array.isArray(spec.rightColumns)
		? spec.rightColumns.filter(Boolean)
		: rightDataset.colunas.map(column => column.nome);

	if ((leftColumns.length + rightColumns.length) === 0) {
		return { ok: false, message: t('chive-join-error-columns-required') };
	}

	try {
		const result = joinDatasets({
			leftRows: leftDataset.dados,
			rightRows: rightDataset.dados,
			leftKeys,
			rightKeys,
			joinType: normalizeJoinType(spec.joinType),
			leftColumns,
			rightColumns,
			leftDatasetName: leftDataset.nome,
			rightDatasetName: rightDataset.nome,
			normalization: {
				trim: true,
				caseSensitive: false,
			},
		});

		const processed = processData(result.rows);
		const fallbackColumns = result.outputColumns.map(columnName => ({ nome: columnName, tipo: 'texto' }));
		const datasetName = buildJoinDatasetName(leftDataset.nome, rightDataset.nome);
		const dataset = {
			nome: datasetName,
			tamanho: t('chive-join-generated-size', [result.rows.length]),
			dados: processed.dados,
			colunas: processed.colunas.length > 0 ? processed.colunas : fallbackColumns,
			colunasSelecionadas: (processed.colunas.length > 0 ? processed.colunas : fallbackColumns).map(column => column.nome),
			configGraficos: createDefaultChartConfig(),
		};

		const index = addDataset(dataset);
		if (onDatasetsChangeCallback) {
			onDatasetsChangeCallback();
		}

		return { ok: true, index, datasetName };
	} catch {
		return { ok: false, message: t('chive-join-error-generic') };
	}
}

/**
 * Setup file input listeners
 * Called by main initialization
 */
export function setupFileInputListeners() {
	const inputArquivo = document.getElementById('input-arquivo');
	const zonaUpload = document.getElementById('zona-upload');

	if (inputArquivo) {
		inputArquivo.addEventListener('change', async event => {
			const target = event.target;
			if (!(target instanceof HTMLInputElement)) return;

			try {
				await handleFileUpload(target.files);
			} finally {
				// Allow selecting the same file again and still trigger `change`.
				target.value = '';
			}
		});
	} else {
		showError(t('chive-error-upload-input-missing'));
	}

	if (zonaUpload) {
		// Click to open file picker
		zonaUpload.addEventListener('click', () => {
			inputArquivo?.click();
		});

		// Keyboard support (Enter/Space)
		zonaUpload.addEventListener('keydown', event => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				inputArquivo?.click();
			}
		});

		// Drag and drop
		zonaUpload.addEventListener('dragover', event => {
			event.preventDefault();
			event.stopPropagation();
			zonaUpload.classList.add('hover');
		});

		zonaUpload.addEventListener('dragleave', () => {
			zonaUpload.classList.remove('hover');
		});

		zonaUpload.addEventListener('drop', event => {
			event.preventDefault();
			event.stopPropagation();
			zonaUpload.classList.remove('hover');
			handleFileUpload(event.dataTransfer.files);
		});
	} else {
		showError(t('chive-error-upload-zone-missing'));
	}
}
