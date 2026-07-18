/**
 * CHIVE dataset controller.
 *
 * Dataset workspace feature controller. Handles file upload and dataset
 * management:
 *   - File selection (input or drag-and-drop) and parsing via the worker
 *   - Dataset add/remove/select
 *   - File-format and size validation
 *   - Row-limit handling
 *   - Dataset joins (`createJoinedDataset`)
 *
 * @typedef {import('../../types.js').Dataset} Dataset
 * @typedef {import('../../types.js').JoinDatasetResult} JoinDatasetResult
 * @typedef {import('../../types.js').JoinType} JoinType
 */

import { t } from '../../services/i18nService.js';
import { processData } from '../../domain/datasets/processData.js';
import { joinDatasets } from '../../domain/datasets/join.js';
import { formatFileSize } from '../../utils/formatters.js';
import { ingestFile, progressLabelForStage, ingestErrorMessage } from '../../services/dataIngestService.js';
import { loadPresetSource } from '../../services/presetService.js';
import { addDataset, removeDataset, setActiveDataset, getAllDatasets } from '../../state/appState.js';
import { showError, showFeedback, clearErrors, showProgress } from '../../ui/feedback.js';
import { FILE_SIZE_LIMIT_BYTES, ROW_LIMIT } from '../../config/limits.js';
import { DELIMITED_EXTENSIONS } from '../../config/formats.js';
import { createDefaultChartConfig } from '../../config/chartDefaults.js';

// Confirmation function for user prompts, injectable for testing, defaults to window.confirm
let confirmFn = message => window.confirm(message);

/**
 * Initialize the dataset controller. Wires the confirmation function used for the
 * over-limit file-size prompt (injectable for testing; production callers can
 * omit it).
 *
 * Dataset-list renders are not wired here: every add/remove/select routes
 * through the data facade and emits `DATASET_ADDED` / `DATASET_REMOVED` /
 * `ACTIVE_DATASET`, which `app/renderCoordinator.js` subscribes to. There is no
 * change callback.
 *
 * @param {{ confirmCallback?: ((message: string) => boolean) | null }} [options] - `confirmCallback` defaults to `window.confirm`. Tolerates `null`/omitted.
 */
export function initDatasetController(options = {}) {
	const { confirmCallback = null } = options ?? {};
	confirmFn = confirmCallback || (message => window.confirm(message));
}

/**
 * Process every file from the input or drop event. Failures on
 * individual files are caught and routed to `showError`; the loop
 * continues so a single bad file does not block the rest of the batch.
 *
 * Each successful file calls `addDataset`, which emits `DATASET_ADDED`; the
 * render-coordinator subscription re-renders the dataset view (coalesced per microtask),
 * so a batch renders progressively, one paint per added file.
 *
 * @param {FileList | File[] | null | undefined} files
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
}

/**
 * Process a single file in four stages: validate extension → confirm
 * over-limit size → read via FileReader → ingest in the worker → assemble
 * and add the Dataset. Throws on any non-recoverable error.
 *
 * @private
 * @param {File} file
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
		const confirmedLargeFile = confirmFn(
			`${t('chive-warn-file-size', [file.name, formatFileSize(FILE_SIZE_LIMIT_BYTES)])} \n${t('chive-warn-file-size-proceed')}`
		);
		if (!confirmedLargeFile) {
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
		const message = ingestErrorMessage(result.reason);
		progress.fail(t('chive-progress-failed', [message]));
		throw new Error(`${t('chive-error-parse')}: ${message}`);
	}

	const { rows, columns, statsNumeric, statsCategorical, truncatedFrom } = result.value;

	if (rows.length === 0) {
		progress.fail(t('chive-progress-failed', [t('chive-error-empty-file')]));
		throw new Error(t('chive-error-empty-file'));
	}

	const dataset = {
		name: file.name,
		sizeLabel: formatFileSize(file.size),
		rows,
		columns,
		selectedColumns: columns.map(column => column.name),
		chartConfig: createDefaultChartConfig(),
		// Stats computed in the worker, statsView reads these instead of recomputing
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
		const reader = new FileReader();
		reader.onload = event => resolve(event.target.result);
		reader.onerror = () => reject(new Error(t('chive-error-read', [file.name])));
		reader.readAsText(file);
	});
}

/**
 * Select a dataset as active. The facade emits `ACTIVE_DATASET`, which drives
 * the re-render.
 * @param {number} index - Dataset index
 */
export function selectDataset(index) {
	try {
		setActiveDataset(index);
	} catch (err) {
		showError(err.message);
	}
}

/**
 * Remove a dataset. The facade emits `DATASET_REMOVED`, which drives the
 * re-render.
 * @param {number} index - Dataset index
 */
export function removeDatasetByIndex(index) {
	try {
		removeDataset(index);
	} catch (err) {
		showError(err.message);
	}
}

/**
 * @returns {Dataset[]} Live reference to the datasets array. Do not mutate.
 */
export function getLoadedDatasets() {
	return getAllDatasets();
}

/**
 * Build a human-readable name for a joined dataset:
 * `"<i18n prefix> <leftBase> + <rightBase> (<timestamp>)"`. Both bases
 * are stripped of file extensions and truncated to 24 chars with an
 * ellipsis when longer.
 *
 * @private
 */
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

/**
 * Clamp `value` to a recognized join type; unknown values fall back to
 * `'inner'`.
 *
 * @private
 */
function normalizeJoinType(value) {
	return ['inner', 'left', 'right', 'full'].includes(value) ? value : 'inner';
}

/**
 * Build a new dataset by joining two existing datasets. Reads the
 * datasets by index from app state, runs `joinDatasets`, normalizes the
 * resulting rows via `processData`, and adds the new dataset.
 *
 * Failure messages are translated i18n keys (`'chive-join-error-*'`)
 * suitable for piping straight into `showError`.
 *
 * @param {Object} [spec]
 * @param {number} spec.leftIndex - Index into `appState.data.datasets`.
 * @param {number} spec.rightIndex
 * @param {string[]} spec.leftKeys - Composite key columns from the left dataset.
 * @param {string[]} spec.rightKeys - Same length as `leftKeys`.
 * @param {string[]} [spec.leftColumns] - Columns from left to include; defaults to all.
 * @param {string[]} [spec.rightColumns] - Columns from right to include; defaults to all.
 * @param {JoinType} [spec.joinType='inner'] - Unknown values silently fall back to `'inner'`.
 * @returns {JoinDatasetResult} On success: `{ ok: true, index, datasetName }`. On failure: `{ ok: false, message }`.
 * @fires STATE_EVENTS.DATASET_ADDED - On success.
 */
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
		: leftDataset.columns.map(column => column.name);
	const rightColumns = Array.isArray(spec.rightColumns)
		? spec.rightColumns.filter(Boolean)
		: rightDataset.columns.map(column => column.name);

	if ((leftColumns.length + rightColumns.length) === 0) {
		return { ok: false, message: t('chive-join-error-columns-required') };
	}

	try {
		const result = joinDatasets({
			leftRows: leftDataset.rows,
			rightRows: rightDataset.rows,
			leftKeys,
			rightKeys,
			joinType: normalizeJoinType(spec.joinType),
			leftColumns,
			rightColumns,
			leftDatasetName: leftDataset.name,
			rightDatasetName: rightDataset.name,
			normalization: {
				trim: true,
				caseSensitive: false,
			},
		});

		if (!result.ok) {
			return { ok: false, message: t('chive-join-error-generic') };
		}

		const processed = processData(result.rows);
		const fallbackColumns = result.outputColumns.map(columnName => ({ name: columnName, type: 'text' }));
		const datasetName = buildJoinDatasetName(leftDataset.name, rightDataset.name);
		const dataset = {
			name: datasetName,
			sizeLabel: t('chive-join-generated-size', [result.rows.length]),
			rows: processed.rows,
			columns: processed.columns.length > 0 ? processed.columns : fallbackColumns,
			selectedColumns: (processed.columns.length > 0 ? processed.columns : fallbackColumns).map(column => column.name),
			chartConfig: createDefaultChartConfig(),
		};

		const index = addDataset(dataset);

		return { ok: true, index, datasetName };
	} catch {
		return { ok: false, message: t('chive-join-error-generic') };
	}
}

/**
 * Wire the file input + drop-zone listeners. Handles click-to-open,
 * keyboard activation (Enter/Space), drag hover styling, and drop
 * delegation into {@link handleFileUpload}. The input's `value` is
 * cleared after each upload so re-selecting the same file still fires.
 * Surfaces an error toast if either expected DOM element is missing.
 */
export function setupFileInputListeners() {
	const fileInput = document.getElementById('file-input');
	const uploadZone = document.getElementById('upload-zone');

	if (fileInput) {
		fileInput.addEventListener('change', async event => {
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

	if (uploadZone) {
		// Click to open file picker
		uploadZone.addEventListener('click', () => {
			fileInput?.click();
		});

		// Keyboard support (Enter/Space)
		uploadZone.addEventListener('keydown', event => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				fileInput?.click();
			}
		});

		// Drag and drop
		uploadZone.addEventListener('dragover', event => {
			event.preventDefault();
			event.stopPropagation();
			uploadZone.classList.add('hover');
		});

		uploadZone.addEventListener('dragleave', () => {
			uploadZone.classList.remove('hover');
		});

		uploadZone.addEventListener('drop', event => {
			event.preventDefault();
			event.stopPropagation();
			uploadZone.classList.remove('hover');
			handleFileUpload(event.dataTransfer.files);
		});
	} else {
		showError(t('chive-error-upload-zone-missing'));
	}
}

/**
 * Handle a join request from the dataset-list UI. Delegates to
 * {@link createJoinedDataset}; on success, activates the new dataset and shows a
 * success toast. Failures surface as error toasts with the translated message.
 * Re-render is driven by the `DATASET_ADDED` / `ACTIVE_DATASET` emits.
 *
 * @param {Object} spec - Forwarded to `createJoinedDataset`.
 */
export function handleJoinDatasetRequest(spec) {
	const result = createJoinedDataset(spec);
	if (!result?.ok) {
		showError(result?.message || t('chive-join-error-generic'));
		return;
	}

	selectDataset(result.index);
	showFeedback(t('chive-join-success', [result.datasetName]));
}

/**
 * Handle a preset dataset request. Resolves the preset source (inline or
 * fetched), runs the ingest pipeline (worker for fetched / `processData` sync
 * for inline), and adds the resulting dataset. The progress toast carries the
 * cancellation signal for both the fetch and the worker. Re-render is driven by
 * the `DATASET_ADDED` / `ACTIVE_DATASET` emits.
 *
 * `loadPresetSource` returns a result: `{ ok:false, reason:'preset-fetch-timeout' }`
 * surfaces a dedicated timeout message, `'cancelled'` closes the toast quietly,
 * and every other reason is reported as a generic join/preset error.
 *
 * @param {import('../types.js').PresetDescriptor & { nameKey: string, rows: number }} preset
 * @returns {Promise<void>}
 */
export async function handlePresetDatasetRequest(preset) {
	if (!preset) {
		showError(t('chive-join-error-generic'));
		return;
	}

	const presetName = t(preset.nameKey);
	const progress = showProgress(t('chive-progress-parsing', [presetName]));
	const abortController = new AbortController();
	progress.onCancel(() => abortController.abort());

	try {
		const result = await loadPresetSource(preset, { signal: abortController.signal });

		if (!result.ok) {
			if (result.reason === 'cancelled') {
				progress.close();
			} else if (result.reason === 'preset-fetch-timeout') {
				progress.fail(t('chive-preset-fetch-timeout', [presetName]));
				showError(t('chive-join-error-generic'));
			} else {
				progress.fail(t('chive-progress-failed', [result.reason || 'preset-error']));
				showError(t('chive-join-error-generic'));
			}
			return;
		}

		const source = result.value;

		let rows;
		let columns;
		let statsNumeric = [];
		let statsCategorical = [];

		if (source.mode === 'inline') {
			// Inline presets are tiny demo arrays, sync processData is cheap.
			rows = source.rows;
			if (source.dropColumns.length > 0) {
				const dropSet = new Set(source.dropColumns);
				rows = rows.map(row => {
					const next = { ...row };
					dropSet.forEach(key => { delete next[key]; });
					return next;
				});
			}
			const processed = processData(rows);
			rows = processed.rows;
			columns = processed.columns;
			progress.update(100);
		} else {
			const ingestResult = await ingestFile(
				{ kind: source.kind, text: source.text, options: { dropColumns: source.dropColumns } },
				{
					signal: abortController.signal,
					onProgress: ({ stage, percent }) => {
						progress.update(percent, progressLabelForStage(stage, presetName));
					},
				},
			);

			if (!ingestResult.ok) {
				if (ingestResult.reason === 'cancelled') progress.close();
				else progress.fail(t('chive-progress-failed', [ingestErrorMessage(ingestResult.reason)]));
				return;
			}

			({ rows, columns, statsNumeric, statsCategorical } = ingestResult.value);
		}

		const dataset = {
			name: presetName,
			sizeLabel: t('chive-preset-generated-size', [preset.rows]),
			rows,
			columns,
			selectedColumns: columns.map(c => c.name),
			chartConfig: createDefaultChartConfig(),
			precomputedStats: { numeric: statsNumeric, categorical: statsCategorical },
		};

		const index = addDataset(dataset);
		selectDataset(index);
		progress.succeed(t('chive-preset-load-success', [presetName]));
	} catch (err) {
		// Genuinely-unexpected throws from processData/addDataset/selectDataset.
		progress.fail(t('chive-progress-failed', [err?.message || 'error']));
		showError(t('chive-join-error-generic'));
	}
}
