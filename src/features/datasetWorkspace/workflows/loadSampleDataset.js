/**
 * Controller-internal sample dataset workflow.
 *
 * Adds a bundled sample through the shared intake with a source that fetches
 * the sample's file and runs Ingest on it. Dataset selection comes from the
 * controller, threaded in by the caller.
 *
 * @typedef {import('../../../types.js').IntakeSource} IntakeSource
 * @typedef {import('../../../types.js').Result} Result
 */

import { t } from '../../../services/i18nService.js';
import { ingestFile } from '../../../services/dataIngestService.js';
import { loadSampleDatasetSource } from '../../../services/sampleDatasetService.js';
import { showError } from '../../../ui/feedback.js';
import { fail } from '../../../utils/result.js';
import { runIntake } from './intake.js';

/**
 * Load a sample dataset and select it.
 *
 * Failures name the sample: a fetch timeout explains itself, a known parser
 * failure keeps its translated detail, and anything else asks to try again.
 * Internal reason codes stay off the page. A missing descriptor shows an
 * unnamed error notice and no progress toast.
 *
 * @param {import('../../../types.js').SampleDatasetDescriptor & { nameKey: string, rowCount: number }} sampleDataset
 * @param {{ selectDataset: (index: number) => void }} dependencies
 * @returns {Promise<Result>} The intake's result, or `fail('sample-dataset-missing')`.
 */
export async function loadSampleDataset(sampleDataset, { selectDataset }) {
	if (!sampleDataset) {
		showError(t('chive-sample-dataset-load-error-generic'));
		return fail('sample-dataset-missing');
	}
	return runIntake(sampleDatasetSource(sampleDataset), { selectDataset });
}

/**
 * @private
 * @param {import('../../../types.js').SampleDatasetDescriptor & { nameKey: string, rowCount: number }} sampleDataset
 * @returns {IntakeSource}
 */
function sampleDatasetSource(sampleDataset) {
	const name = t(sampleDataset.nameKey);
	return {
		name,
		progressLabel: t('chive-progress-parsing', name),
		async ingest(request) {
			const loaded = await loadSampleDatasetSource(sampleDataset, { signal: request.signal });
			if (!loaded.ok) return loaded;
			const { kind, text, dropColumns } = loaded.value;
			return ingestFile({ kind, text, options: { dropColumns } }, request);
		},
		sizeLabel: () => t('chive-sample-dataset-generated-size', sampleDataset.rowCount),
		// Samples ship with CHIVE and are kept small, so the row limit does not apply.
		rowWarning: null,
		successMessage: t('chive-sample-dataset-load-success', name),
		failureMessage: (detail, reason) => {
			if (reason === 'sample-dataset-fetch-timeout') return t('chive-sample-dataset-fetch-timeout', name);
			return detail
				? t('chive-sample-dataset-load-failed-detail', name, detail)
				: t('chive-sample-dataset-load-failed', name);
		},
	};
}
