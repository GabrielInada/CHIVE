/**
 * Controller-internal join workflow.
 *
 * Validates the join, then adds it through the shared intake with a source
 * that runs the join and Ingest in the data worker.
 *
 * @typedef {import('../../../types.js').IntakeSource} IntakeSource
 * @typedef {import('../../../types.js').JoinType} JoinType
 * @typedef {import('../../../types.js').Result} Result
 */

import { t } from '../../../services/i18nService.js';
import { joinDatasetsInWorker } from '../../../services/dataIngestService.js';
import { getAllDatasets } from '../../../state/appState.js';
import { showError } from '../../../ui/feedback.js';
import { joinValidationMessageKey, validateJoinSpec } from '../joinValidation.js';
import { runIntake } from './intake.js';

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
 * Join two loaded datasets into a new dataset and select it. An invalid spec
 * shows its validation message in an error notice before any work starts;
 * everything after that is the intake's.
 *
 * @param {Object} [spec]
 * @param {number} spec.leftIndex - Index into `appState.data.datasets`.
 * @param {number} spec.rightIndex
 * @param {string[]} spec.leftKeys - Composite key columns from the left dataset.
 * @param {string[]} spec.rightKeys - Same length as `leftKeys`.
 * @param {string[]} [spec.leftColumns] - Columns from left to include; defaults to all.
 * @param {string[]} [spec.rightColumns] - Columns from right to include; defaults to all.
 * @param {JoinType} [spec.joinType='inner'] - Unknown values silently fall back to `'inner'`.
 * @param {Object} [dependencies]
 * @param {(message: string) => boolean | Promise<boolean>} [dependencies.confirm] - Answers the row warning. Without it, an over-limit join is declined.
 * @param {(index: number) => void} [dependencies.selectDataset]
 * @returns {Promise<Result>} The intake's result, or `fail(reason)` with the validation reason.
 * @fires STATE_EVENTS.DATASET_ADDED - On success.
 */
export async function createJoinedDataset(spec = {}, { confirm, selectDataset } = {}) {
	const validation = validateJoinSpec(getAllDatasets(), spec);
	if (!validation.ok) {
		showError(t(joinValidationMessageKey(validation.reason)));
		return validation;
	}
	return runIntake(joinSource(validation, normalizeJoinType(spec.joinType)), { confirm, selectDataset });
}

/**
 * @private
 * @param {Object} validation - A valid result of `validateJoinSpec`.
 * @param {JoinType} joinType
 * @returns {IntakeSource}
 */
function joinSource({ leftDataset, rightDataset, leftKeys, rightKeys, leftColumns, rightColumns }, joinType) {
	const name = buildJoinDatasetName(leftDataset.name, rightDataset.name);
	return {
		name,
		progressLabel: t('chive-progress-joining'),
		// No row limit here: a capped first pass would run the join twice once
		// approved, so the intake checks the complete result instead.
		ingest: ({ signal, onProgress }) => joinDatasetsInWorker({
			leftRows: leftDataset.rows,
			rightRows: rightDataset.rows,
			leftKeys,
			rightKeys,
			joinType,
			leftColumns,
			rightColumns,
			leftColumnSpecs: leftDataset.columns,
			rightColumnSpecs: rightDataset.columns,
			leftDatasetName: leftDataset.name,
			rightDatasetName: rightDataset.name,
			normalization: {
				trim: true,
				caseSensitive: false,
			},
		}, { signal, onProgress }),
		sizeLabel: rowCount => t('chive-join-generated-size', rowCount),
		rowWarning: (rowCount, rowLimit) => t('chive-warn-large-join', rowCount, rowLimit),
		successMessage: t('chive-join-success', name),
		failureMessage: () => t('chive-join-failed', leftDataset.name, rightDataset.name),
	};
}
