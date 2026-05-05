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
import { processData, formatFileSize, joinDatasets } from '../services/dataService.js';
import { ingestFile, progressLabelForStage } from '../services/dataIngestService.js';
import { addDataset, removeDataset, setActiveDataset, getAllDatasets } from './appState.js';
import { showError, clearErrors, showProgress } from './feedbackUI.js';
import { FILE_SIZE_LIMIT_BYTES, ROW_LIMIT } from '../config/limits.js';
import { DELIMITED_EXTENSIONS } from '../config/formats.js';
import { createDefaultChartConfig } from '../config/chartDefaults.js';

// Callback when dataset list changes
let onDatasetsChangeCallback = null;

// Confirmation function for user prompts — injectable for testing, defaults to window.confirm
let confirmFn = message => window.confirm(message);

/**
 * Initialize file manager
 * @param {Function} changeCallback - Called when dataset list changes
 * @param {Function} [confirmCallback] - Confirmation dialog function, defaults to window.confirm
 */
export function initFileManager(changeCallback = null, confirmCallback = null) {
	onDatasetsChangeCallback = changeCallback;
	confirmFn = confirmCallback || (message => window.confirm(message));
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
	const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
	const isDelimited = DELIMITED_EXTENSIONS.includes(extension);
	const isJson = extension === 'json';

	if (!isDelimited && !isJson) {
		throw new Error(t('chive-error-format', [file.name]));
	}

	// Check file size
	if (file.size > FILE_SIZE_LIMIT_BYTES) {
		const confirmarArquivoGrande = confirmFn(
			`${t('chive-warn-file-size', [file.name, formatFileSize(FILE_SIZE_LIMIT_BYTES)])} \n${t('chive-warn-file-size-proceed')}`
		);
		if (!confirmarArquivoGrande) {
			throw new Error(t('chive-error-cancelled'));
		}
	}

	// Read file (FileReader stays on the main thread; ~100-200ms even for 50MB,
	// dominated by disk I/O. Worker handles the parse/normalize/stats CPU work.)
	const content = await readFile(file);
	const kind = isJson ? 'json' : 'csv';

	const progress = showProgress(t('chive-progress-parsing', [file.name]));
	const abortController = new AbortController();
	progress.onCancel(() => abortController.abort());

	const result = await ingestFile(
		{ kind, text: content, options: { rowLimit: ROW_LIMIT } },
		{
			signal: abortController.signal,
			onProgress: ({ stage, percent }) => {
				progress.update(percent, progressLabelForStage(stage, file.name));
			},
		},
	);

	if (!result.ok) {
		if (result.reason === 'cancelled') {
			progress.close();
			throw new Error(t('chive-error-cancelled'));
		}
		progress.fail(t('chive-progress-failed', [result.reason]));
		throw new Error(`${t('chive-error-parse')}: ${result.reason}`);
	}

	const { dados, colunas, statsNumeric, statsCategorical, truncatedFrom } = result.value;

	if (dados.length === 0) {
		progress.fail(t('chive-progress-failed', [t('chive-error-empty-file')]));
		throw new Error(t('chive-error-empty-file'));
	}

	const dataset = {
		nome: file.name,
		tamanho: formatFileSize(file.size),
		dados,
		colunas,
		colunasSelecionadas: colunas.map(coluna => coluna.nome),
		configGraficos: createDefaultChartConfig(),
		// Stats computed in the worker — statsView reads these instead of recomputing
		// on every DATASET_ADDED event. See `services/dataIngestService.js`.
		precomputedStats: { numeric: statsNumeric, categorical: statsCategorical },
	};
	addDataset(dataset);

	const successLabel = truncatedFrom
		? t('chive-progress-ready-truncated', [file.name, truncatedFrom, ROW_LIMIT])
		: t('chive-progress-ready', [file.name]);
	progress.succeed(successLabel);
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
