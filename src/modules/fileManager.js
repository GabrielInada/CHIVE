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
import { parsearCSV, parsearJSON, processarDados, formatarTamanhoArquivo } from '../services/dataService.js';
import { addDataset, removeDataset, setActiveDataset, getAllDatasets } from './appState.js';
import { showError, clearErrors } from './feedbackUI.js';
import { FILE_SIZE_LIMIT_BYTES, ROW_LIMIT } from '../config/index.js';
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
			`${t('chive-warn-file-size', [file.name, formatarTamanhoArquivo(FILE_SIZE_LIMIT_BYTES)])} \n${t('chive-warn-file-size-proceed')}`
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
			dadosBrutos = parsearCSV(content);
		} else {
			dadosBrutos = parsearJSON(content);
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
	const processado = processarDados(dadosBrutos, file.name);
	const dataset = {
		nome: file.name,
		tamanho: formatarTamanhoArquivo(file.size),
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

/**
 * Setup file input listeners
 * Called by main initialization
 */
export function setupFileInputListeners() {
	const inputArquivo = document.getElementById('input-arquivo');
	const zonaUpload = document.getElementById('zona-upload');

	if (inputArquivo) {
		inputArquivo.addEventListener('change', event => {
			handleFileUpload(event.target.files);
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
