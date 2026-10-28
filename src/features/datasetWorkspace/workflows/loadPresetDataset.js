/**
 * Controller-internal preset dataset workflow.
 *
 * Owns preset source loading, ingest, dataset assembly, progress feedback, and
 * selection through the controller callback supplied by the caller.
 */

import { t } from '../../../services/i18nService.js';
import { ingestFile, progressLabelForStage, ingestErrorMessage } from '../../../services/dataIngestService.js';
import { loadPresetSource } from '../../../services/presetService.js';
import { addDataset } from '../../../state/appState.js';
import { showError, showProgress } from '../../../ui/feedback.js';
import { createDefaultChartConfig } from '../../../config/charts/defaults.js';

/**
 * Resolve and load a preset dataset.
 *
 * `loadPresetSource` returns a result: `{ ok:false, reason:'preset-fetch-timeout' }`
 * surfaces a dedicated timeout message, `'cancelled'` closes the toast quietly,
 * and every other reason is reported as a generic join/preset error.
 *
 * @param {import('../../../types.js').PresetDescriptor & { nameKey: string, rows: number }} preset
 * @param {{ selectDataset: (index: number) => void }} dependencies
 * @returns {Promise<void>}
 */
export async function loadPresetDataset(preset, { selectDataset }) {
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

		const { rows, columns, precomputedStats } = ingestResult.value;

		const dataset = {
			name: presetName,
			sizeLabel: t('chive-preset-generated-size', [preset.rows]),
			rows,
			columns,
			selectedColumns: columns.map(c => c.name),
			chartConfig: createDefaultChartConfig(),
			precomputedStats,
		};

		const index = addDataset(dataset);
		selectDataset(index);
		progress.succeed(t('chive-preset-load-success', [presetName]));
	} catch (err) {
		// Genuinely-unexpected throws from addDataset/selectDataset.
		progress.fail(t('chive-progress-failed', [err?.message || 'error']));
		showError(t('chive-join-error-generic'));
	}
}
