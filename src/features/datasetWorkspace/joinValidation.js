/**
 * Shared validation for join-dialog drafts and the join workflow.
 *
 * Keeping this contract outside either caller prevents the UI and state
 * mutation path from drifting into different definitions of a valid join.
 */

import { ok, fail } from '../../utils/result.js';

const MESSAGE_KEYS = Object.freeze({
	'min-files': 'chive-join-error-min-files',
	'invalid-file-selection': 'chive-join-error-invalid-file-selection',
	'same-file': 'chive-join-error-select-different-files',
	'keys-required': 'chive-join-error-keys-required',
	'key-count-mismatch': 'chive-join-error-key-count-mismatch',
	'columns-required': 'chive-join-error-columns-required',
});

/**
 * @param {string} reason
 * @returns {string}
 */
export function joinValidationMessageKey(reason) {
	return MESSAGE_KEYS[reason] || 'chive-join-error-generic';
}

/**
 * Validate and normalize the parts of a join spec shared by the dialog and
 * workflow. Omitted column arrays retain the workflow's historical behavior of
 * selecting every source column.
 *
 * @param {Array<{ columns?: Array<{ name: string }> }>} datasets
 * @param {Object} [spec]
 * @returns {{ ok: true, leftIndex: number, rightIndex: number, leftDataset: Object, rightDataset: Object, leftKeys: string[], rightKeys: string[], leftColumns: string[], rightColumns: string[] } | { ok: false, reason: string }}
 */
export function validateJoinSpec(datasets, spec = {}) {
	if (!Array.isArray(datasets) || datasets.length < 2) return fail('min-files');

	const leftIndex = Number(spec?.leftIndex);
	const rightIndex = Number(spec?.rightIndex);
	const leftDataset = datasets[leftIndex];
	const rightDataset = datasets[rightIndex];
	if (Number.isNaN(leftIndex) || Number.isNaN(rightIndex) || !leftDataset || !rightDataset) {
		return fail('invalid-file-selection');
	}
	if (leftIndex === rightIndex) return fail('same-file');

	const leftKeys = Array.isArray(spec.leftKeys) ? spec.leftKeys.filter(Boolean) : [];
	const rightKeys = Array.isArray(spec.rightKeys) ? spec.rightKeys.filter(Boolean) : [];
	if (leftKeys.length === 0 || rightKeys.length === 0) return fail('keys-required');
	if (leftKeys.length !== rightKeys.length) return fail('key-count-mismatch');

	const leftColumns = Array.isArray(spec.leftColumns)
		? spec.leftColumns.filter(Boolean)
		: (leftDataset.columns || []).map(column => column.name);
	const rightColumns = Array.isArray(spec.rightColumns)
		? spec.rightColumns.filter(Boolean)
		: (rightDataset.columns || []).map(column => column.name);
	if ((leftColumns.length + rightColumns.length) === 0) return fail('columns-required');

	return ok({
		leftIndex,
		rightIndex,
		leftDataset,
		rightDataset,
		leftKeys,
		rightKeys,
		leftColumns,
		rightColumns,
	});
}
