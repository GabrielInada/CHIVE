/**
 * Controller-internal dataset join workflow.
 *
 * Owns join validation, domain joining, dataset normalization, naming, and
 * insertion into state. The controller remains the public feature surface.
 *
 * @typedef {import('../../../types.js').JoinDatasetResult} JoinDatasetResult
 * @typedef {import('../../../types.js').JoinType} JoinType
 */

import { t, getLocale } from '../../../services/i18nService.js';
import { joinDatasetsInWorker } from '../../../services/dataIngestService.js';
import { addDataset, getAllDatasets } from '../../../state/appState.js';
import { createDefaultChartConfig } from '../../../config/charts/defaults.js';
import { ROW_LIMIT } from '../../../config/limits.js';
import { joinValidationMessageKey, validateJoinSpec } from '../joinValidation.js';

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
 * datasets by index from app state, runs the join and normalization pipeline
 * in the data worker, and adds the complete new dataset after any over-limit
 * warning is approved.
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
 * @param {Object} [dependencies]
 * @param {(message: string) => boolean | Promise<boolean>} [dependencies.confirm]
 * @param {AbortSignal} [dependencies.signal]
 * @param {(progress: import('../../../types.js').IngestProgress) => void} [dependencies.onProgress]
 * @returns {Promise<JoinDatasetResult>} On success: `{ ok: true, index, datasetName }`. On failure: `{ ok: false, message }`.
 * @fires STATE_EVENTS.DATASET_ADDED - On success.
 */
export async function createJoinedDataset(spec = {}, dependencies = {}) {
	const {
		confirm = () => false,
		signal,
		onProgress,
	} = dependencies;
	const datasets = getAllDatasets();
	const validation = validateJoinSpec(datasets, spec);
	if (!validation.ok) {
		return {
			ok: false,
			reason: validation.reason,
			message: t(joinValidationMessageKey(validation.reason)),
		};
	}
	const {
		leftDataset,
		rightDataset,
		leftKeys,
		rightKeys,
		leftColumns,
		rightColumns,
	} = validation;

	try {
		const result = await joinDatasetsInWorker({
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
		}, {
			signal,
			onProgress,
		});

		if (!result.ok) {
			return {
				ok: false,
				reason: result.reason,
				message: result.reason === 'cancelled'
					? t('chive-error-cancelled')
					: t('chive-join-error-generic'),
			};
		}

		const {
			rows,
			columns,
			outputColumns = [],
			statsNumeric = [],
			statsCategorical = [],
		} = result.value;

		if (rows.length > ROW_LIMIT) {
			const locale = getLocale();
			const approved = await confirm(t('chive-warn-large-join', [
				rows.length.toLocaleString(locale),
				ROW_LIMIT.toLocaleString(locale),
			]));
			if (!approved) {
				return {
					ok: false,
					reason: 'cancelled',
					message: t('chive-error-cancelled'),
				};
			}
		}

		const fallbackColumns = outputColumns.map(columnName => ({ name: columnName, type: 'text' }));
		const resolvedColumns = columns.length > 0 ? columns : fallbackColumns;
		const datasetName = buildJoinDatasetName(leftDataset.name, rightDataset.name);
		const dataset = {
			name: datasetName,
			sizeLabel: t('chive-join-generated-size', [rows.length]),
			rows,
			columns: resolvedColumns,
			selectedColumns: resolvedColumns.map(column => column.name),
			chartConfig: createDefaultChartConfig(),
			precomputedStats: {
				numeric: statsNumeric,
				categorical: statsCategorical,
			},
		};

		const index = addDataset(dataset);

		return { ok: true, index, datasetName };
	} catch {
		return { ok: false, reason: 'worker-error', message: t('chive-join-error-generic') };
	}
}
