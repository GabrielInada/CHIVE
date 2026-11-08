/**
 * Controller-internal upload workflow.
 *
 * Checks each file's format and size, then adds it through the shared intake
 * with a source that reads the file and runs Ingest on its text. The
 * controller supplies its injectable confirmation for each batch.
 *
 * @typedef {import('../../../types.js').IntakeSource} IntakeSource
 * @typedef {import('../../../types.js').Result} Result
 */

import { t } from '../../../services/i18nService.js';
import { formatFileSize } from '../../../utils/formatters.js';
import { ingestFile } from '../../../services/dataIngestService.js';
import { showError, clearErrors } from '../../../ui/feedback.js';
import { FILE_SIZE_LIMIT_BYTES } from '../../../config/limits.js';
import { DELIMITED_EXTENSIONS } from '../../../config/formats.js';
import { ok, fail } from '../../../utils/result.js';
import { runIntake } from './intake.js';

/**
 * Add every file from the input or drop event, one at a time. A file that
 * fails reports its own error and the batch goes on, so one bad file does
 * not block the rest. Error notices from earlier batches are cleared first.
 *
 * Each added file emits `DATASET_ADDED`, and the render coordinator repaints
 * once per animation frame, so a batch renders progressively. Uploads do not
 * select the new dataset; `addDataset` activates only a first one.
 *
 * @param {FileList | File[] | null | undefined} files
 * @param {{ confirm: (message: string) => boolean | Promise<boolean> }} dependencies
 * @param {{ decimalSeparator?: 'auto' | '.' | ',' }} [options] - Format captured when this upload batch starts.
 * @returns {Promise<void>}
 */
export async function uploadDatasetFiles(files, { confirm }, options = {}) {
	if (!files || files.length === 0) return;

	clearErrors();
	for (const file of Array.from(files)) {
		try {
			await uploadFile(file, { confirm }, options);
		} catch {
			// The intake never rejects, so this is a check before it, such as a
			// size confirmation that could not open.
			showError(t('chive-upload-load-failed', file.name));
		}
	}
}

/**
 * Reject an unsupported format, ask before a file above the size limit, then
 * run the intake. Declining the size warning is a cancel, which shows nothing.
 *
 * @private
 * @param {File} file
 * @param {{ confirm: (message: string) => boolean | Promise<boolean> }} dependencies
 * @param {{ decimalSeparator?: 'auto' | '.' | ',' }} options
 * @returns {Promise<void>}
 */
async function uploadFile(file, { confirm }, options) {
	const kind = fileKind(file.name);
	if (!kind) {
		showError(t('chive-error-format', file.name));
		return;
	}
	if (file.size > FILE_SIZE_LIMIT_BYTES) {
		const approved = await confirm(t(
			'chive-warn-large-file',
			file.name,
			formatFileSize(file.size),
			formatFileSize(FILE_SIZE_LIMIT_BYTES),
		));
		if (!approved) return;
	}
	await runIntake(fileSource(file, kind, options), { confirm });
}

/**
 * @private
 * @param {string} fileName
 * @returns {'csv' | 'json' | null} `null` for an unsupported extension.
 */
function fileKind(fileName) {
	const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
	if (extension === 'json') return 'json';
	return DELIMITED_EXTENSIONS.includes(extension) ? 'csv' : null;
}

/**
 * @private
 * @param {File} file
 * @param {'csv' | 'json'} kind
 * @param {{ decimalSeparator?: 'auto' | '.' | ',' }} options
 * @returns {IntakeSource}
 */
function fileSource(file, kind, options) {
	let text = null;
	return {
		name: file.name,
		progressLabel: t('chive-progress-parsing', file.name),
		async ingest({ rowLimit, ...request }) {
			// The uncapped run after an approved row warning reuses the text.
			if (text === null) {
				const read = await readFileText(file);
				if (!read.ok) return read;
				text = read.text;
			}
			const ingestOptions = rowLimit === undefined ? options : { ...options, rowLimit };
			return ingestFile({ kind, text, options: ingestOptions }, request);
		},
		sizeLabel: () => formatFileSize(file.size),
		rowWarning: (rowCount, rowLimit) => t('chive-warn-large-rows', file.name, rowCount, rowLimit),
		successMessage: t('chive-progress-ready', file.name),
		failureMessage: detail => (detail
			? t('chive-upload-load-failed-detail', file.name, detail)
			: t('chive-upload-load-failed', file.name)),
	};
}

/**
 * Read a file as text. FileReader, unlike `Blob.text()`, honors a UTF-16
 * byte order mark.
 *
 * @private
 * @param {File} file
 * @returns {Promise<Result>} `ok({ text })`, or `fail('file-read-error')`.
 */
function readFileText(file) {
	return new Promise(resolve => {
		const reader = new FileReader();
		reader.onload = () => resolve(ok({ text: reader.result }));
		reader.onerror = () => resolve(fail('file-read-error'));
		reader.readAsText(file);
	});
}
