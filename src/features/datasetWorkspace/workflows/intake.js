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
import { ROW_LIMIT } from '../../../config/limits.js';
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
 * A source with a row warning gets the row limit with its first request.
 * When the rows it returns are over the limit, `confirm` decides, and rows
 * that were capped are ingested again without the cap once approved, so the
 * dataset keeps every row. A source that cannot cap returns its complete
 * result, which is checked the same way.
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

	try {
		const limited = typeof source.rowWarning === 'function';
		let result = await source.ingest(limited ? { ...request, rowLimit: ROW_LIMIT } : request);
		if (result.ok && limited) {
			const { rows, truncatedFrom } = result.value;
			const rowCount = truncatedFrom ?? rows.length;
			if (rowCount > ROW_LIMIT) {
				const locale = getLocale();
				const approved = await confirm(source.rowWarning(
					rowCount.toLocaleString(locale),
					ROW_LIMIT.toLocaleString(locale),
				));
				if (!approved) return cancelled();
				if (truncatedFrom) {
					// The capped pass only measured the size.
					progress.update(0, source.progressLabel);
					result = await source.ingest(request);
				}
			}
		}
		if (!result.ok) return result.reason === 'cancelled' ? cancelled() : failed(result.reason);

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
