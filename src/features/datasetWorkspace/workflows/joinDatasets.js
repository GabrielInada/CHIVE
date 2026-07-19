/**
 * Controller-internal dataset join workflow.
 *
 * Owns join validation, domain joining, dataset normalization, naming, and
 * insertion into state. The controller remains the public feature surface.
 *
 * @typedef {import('../../../types.js').JoinDatasetResult} JoinDatasetResult
 * @typedef {import('../../../types.js').JoinType} JoinType
 */

import { t } from '../../../services/i18nService.js';
import { processData } from '../../../domain/datasets/processData.js';
import { joinDatasets } from '../../../domain/datasets/join.js';
import { addDataset, getAllDatasets } from '../../../state/appState.js';
import { createDefaultChartConfig } from '../../../config/charts/defaults.js';

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
