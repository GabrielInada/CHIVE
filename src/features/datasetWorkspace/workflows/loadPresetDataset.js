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
import { loadPresetSource } from '../../../services/presetService.js';
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
 * @param {import('../../../types.js').PresetDescriptor & { nameKey: string, rowCount: number }} preset
 * @param {{ selectDataset: (index: number) => void }} dependencies
 * @returns {Promise<Result>} The intake's result, or `fail('preset-missing')`.
 */
export async function loadPresetDataset(preset, { selectDataset }) {
	if (!preset) {
		showError(t('chive-preset-load-error-generic'));
		return fail('preset-missing');
	}
	return runIntake(sampleSource(preset), { selectDataset });
}

/**
 * @private
 * @param {import('../../../types.js').PresetDescriptor & { nameKey: string, rowCount: number }} preset
 * @returns {IntakeSource}
 */
function sampleSource(preset) {
	const name = t(preset.nameKey);
	return {
		name,
		progressLabel: t('chive-progress-parsing', name),
		async ingest(request) {
			const loaded = await loadPresetSource(preset, { signal: request.signal });
			if (!loaded.ok) return loaded;
			const { kind, text, dropColumns } = loaded.value;
			return ingestFile({ kind, text, options: { dropColumns } }, request);
		},
		sizeLabel: () => t('chive-preset-generated-size', preset.rowCount),
		// Samples ship with CHIVE and are kept small, so the row limit does not apply.
		rowWarning: null,
		successMessage: t('chive-preset-load-success', name),
		failureMessage: (detail, reason) => {
			if (reason === 'preset-fetch-timeout') return t('chive-preset-fetch-timeout', name);
			return detail
				? t('chive-preset-load-failed-detail', name, detail)
				: t('chive-preset-load-failed', name);
		},
	};
}
