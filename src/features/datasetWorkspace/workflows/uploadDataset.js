/**
 * Controller-internal dataset upload workflow.
 *
 * Owns batch error routing, file validation and reading, worker ingest, and
 * dataset assembly. The controller supplies its injectable confirmation
 * dependency for each invocation.
 */

import { t } from '../../../services/i18nService.js';
import { formatFileSize } from '../../../utils/formatters.js';
import { ingestFile, progressLabelForStage, ingestErrorMessage } from '../../../services/dataIngestService.js';
import { addDataset } from '../../../state/appState.js';
import { showError, clearErrors, showProgress } from '../../../ui/feedback.js';
import { FILE_SIZE_LIMIT_BYTES, ROW_LIMIT } from '../../../config/limits.js';
import { DELIMITED_EXTENSIONS } from '../../../config/formats.js';
import { createDefaultChartConfig } from '../../../config/chartDefaults.js';

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
 * @param {{ confirm: (message: string) => boolean }} dependencies
 * @returns {Promise<void>}
 */
export async function uploadDatasetFiles(files, { confirm }) {
	if (!files || files.length === 0) return;

	clearErrors();
	const filesToProcess = Array.from(files);

	for (const file of filesToProcess) {
		try {
			await processFileForDataset(file, { confirm });
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
 * @param {{ confirm: (message: string) => boolean }} dependencies
 */
async function processFileForDataset(file, { confirm }) {
	// Validate file format
	const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
	const isDelimited = DELIMITED_EXTENSIONS.includes(extension);
	const isJson = extension === 'json';

	if (!isDelimited && !isJson) {
		throw new Error(t('chive-error-format', [file.name]));
	}

	// Check file size
	if (file.size > FILE_SIZE_LIMIT_BYTES) {
		const confirmedLargeFile = confirm(
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
