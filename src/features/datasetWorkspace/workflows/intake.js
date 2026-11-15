/**
 * Controller-internal dataset intake.
 *
 * Every way to add a dataset runs through {@link runIntake}: an uploaded
 * file, a join and a sample dataset. It owns the progress toast and its
 * cancel button, the row-limit question, the failure and success messages,
 * the new Dataset's assembly, `addDataset`, and selecting the new dataset.
 * Each workflow describes its data as an {@link IntakeSource}.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 * @typedef {import('../../../types.js').IngestPayload} IngestPayload
 * @typedef {import('../../../types.js').IntakeSource} IntakeSource
 * @typedef {import('../../../types.js').Result} Result
 */

import { getLocale } from '../../../services/i18nService.js';
import { ingestErrorMessage, progressLabelForStage } from '../../../services/dataIngestService.js';
import { addDataset } from '../../../state/appState.js';
import { showError, showProgress } from '../../../ui/feedback.js';
import { LARGE_DATASET_WARNING_ROWS } from '../../../config/limits.js';
import { createDefaultChartConfig } from '../../../config/charts/defaults.js';
import { ok, fail } from '../../../utils/result.js';

/**
 * Add the dataset a source produces.
 *
 * Cancelling from the toast, or declining the row warning, closes the toast
 * and shows nothing else. A failure shows the source's failure message in
 * both the toast and an error notice. The source gets Ingest's translated
 * detail for a known parse failure and an empty string for anything else, so
 * no internal reason code reaches the page.
 *
 * A source with a row warning gets `confirmRowCount` with its request. A
 * source that can pause after parsing calls it with the row count before the
 * rest of ingest runs, so the data is parsed once whatever the answer. Above
 * the row limit, `confirm` decides; approval keeps every row. A source that
 * cannot pause returns its complete result, whose rows are checked the same
 * way.
 *
 * @param {IntakeSource} source
 * @param {Object} [dependencies]
 * @param {(message: string) => boolean | Promise<boolean>} [dependencies.confirm] - Answers the row warning. Without it, the warning is declined.
 * @param {(index: number) => void} [dependencies.selectDataset] - Selects the new dataset. Without it, `addDataset` activates only a first dataset.
 * @returns {Promise<Result>} `ok({ index })` with the new dataset's index, `fail('cancelled')`, or `fail(reason)` with the failure's reason. Never rejects.
 * @fires STATE_EVENTS.DATASET_ADDED - On success.
 */
export async function runIntake(source, { confirm = () => false, selectDataset } = {}) {
	const progress = showProgress(source.progressLabel);
	const abortController = new AbortController();
	progress.onCancel(() => abortController.abort());
	const request = {
		signal: abortController.signal,
		onProgress: ({ stage, percent }) => {
			progress.update(percent, progressLabelForStage(stage, source.name));
		},
	};

	const cancelled = () => {
		progress.close();
		return fail('cancelled');
	};
	const failed = reason => {
		const message = source.failureMessage(ingestErrorMessage(reason, ''), reason);
		progress.fail(message);
		showError(message);
		return fail(reason);
	};

	const limited = typeof source.rowWarning === 'function';
	let rowsChecked = false;
	const approveRows = async ({ rowCount, columnCount }) => {
		rowsChecked = true;
		if (rowCount <= LARGE_DATASET_WARNING_ROWS) return true;
		const locale = getLocale();
		return Boolean(await confirm(source.rowWarning({
			rows: rowCount.toLocaleString(locale),
			columns: columnCount.toLocaleString(locale),
			limit: LARGE_DATASET_WARNING_ROWS.toLocaleString(locale),
			columnCount,
		})));
	};
	if (limited) request.confirmRowCount = approveRows;

	try {
		const result = await source.ingest(request);
		if (!result.ok) return result.reason === 'cancelled' ? cancelled() : failed(result.reason);
		// A source that could not pause is checked on its complete result.
		if (limited && !rowsChecked) {
			const { rows, columns } = result.value;
			if (!(await approveRows({ rowCount: rows.length, columnCount: columns.length }))) return cancelled();
		}

		const index = addDataset(assembleDataset(source, result.value));
		selectDataset?.(index);
		progress.succeed(source.successMessage);
		return ok({ index });
	} catch {
		return abortController.signal.aborted ? cancelled() : failed('intake-error');
	}
}

/**
 * The new Dataset, with every column selected and the default chart config.
 * It keeps the stats Ingest computed, which the stats view reads instead of
 * computing them again.
 *
 * @private
 * @param {IntakeSource} source
 * @param {IngestPayload} payload
 * @returns {Dataset}
 */
function assembleDataset(source, { rows, columns, precomputedStats }) {
	return {
		name: source.name,
		sizeLabel: source.sizeLabel(rows.length),
		rows,
		columns,
		selectedColumns: columns.map(column => column.name),
		chartConfig: createDefaultChartConfig(),
		precomputedStats,
	};
}
