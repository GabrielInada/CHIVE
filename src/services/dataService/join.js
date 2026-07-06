import { isNullish } from '../../utils/formatters.js';
import { ok, fail } from '../../utils/result.js';

/**
 * CHIVE dataset-join helpers.
 *
 * Pure functions for joining two datasets on a composite key, with
 * type-tagged key normalization and column-name conflict resolution. No
 * DOM, no state, no I/O, safe to use in workers and tests.
 *
 * @typedef {import('../../types.js').JoinDatasetsOptions} JoinDatasetsOptions
 * @typedef {import('../../types.js').JoinResult} JoinResult
 */

/**
 * Encode a join-key value into a type-tagged string so distinct types
 * cannot collide (e.g. number `42` vs string `'42'`).
 *
 * @private
 */
function normalizeKeyValue(value, { trim = true, caseSensitive = false } = {}) {
	if (isNullish(value)) return '';

	if (typeof value === 'number') {
		if (!Number.isFinite(value)) return '';
		return `n:${String(value)}`;
	}

	if (typeof value === 'boolean') {
		return `b:${String(value)}`;
	}

	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return `d:${value.toISOString()}`;
	}

	let text = String(value);
	if (trim) text = text.trim();
	if (!caseSensitive) text = text.toLowerCase();
	return `s:${text}`;
}

/**
 * Build a composite join-key string from `keyColumns` joined with a U+0001
 * separator (low enough that natural data never produces it).
 *
 * @private
 */
function buildCompositeKey(row, keyColumns, normalizationOptions) {
	return keyColumns
		.map(columnName => normalizeKeyValue(row?.[columnName], normalizationOptions))
		// WHY: U+0001 (SOH control char) never appears in natural text data, so it
		// can't collide with a real value. A printable separator like ',' or '|'
		// would risk a false match between e.g. ['a,b','c'] and ['a','b,c'].
		.join('\u0001');
}

/**
 * Ensure `baseName` is unique within `usedNames`; append `_2`, `_3`, …
 * until it is. Mutates `usedNames` to record the chosen name.
 *
 * @private
 */
function ensureUniqueColumnName(baseName, usedNames) {
	if (!usedNames.has(baseName)) {
		usedNames.add(baseName);
		return baseName;
	}

	let suffix = 2;
	let nextName = `${baseName}_${suffix}`;
	while (usedNames.has(nextName)) {
		suffix += 1;
		nextName = `${baseName}_${suffix}`;
	}
	usedNames.add(nextName);
	return nextName;
}

/**
 * Strip the extension from a filename and reduce to safe chars
 * (`[A-Za-z0-9_\- ]`), collapsing whitespace to dashes. Returns `fallback`
 * when the result is empty.
 *
 * @private
 */
function sanitizePrefix(fileName, fallback) {
	const base = String(fileName || '')
		.replace(/\.[^.]+$/, '')
		.trim()
		.replace(/[^\w\- ]+/g, '')
		.replace(/\s+/g, '-');
	return base || fallback;
}

/**
 * Join two datasets on a composite key.
 *
 * `leftKeys[i]` is matched against `rightKeys[i]` after type-tagged
 * normalization (numbers, booleans, and dates do not collide with strings;
 * trimming and case-folding are configurable via `normalization`).
 *
 * Column-name conflicts are resolved by prefixing both sides with their
 * dataset name (sanitized): a conflict on `salary` from `sales-q1.csv`
 * and `sales-q2.csv` becomes `sales-q1.salary` and `sales-q2.salary`.
 * Further conflicts (same column carried twice on the same side) get
 * `_2`, `_3`, … suffixes.
 *
 * Unmatched cells in left/right/full joins are emitted as `null`.
 *
 * @param {JoinDatasetsOptions} options
 * @returns {JoinResult} `{ ok:true, rows, outputColumns }` on success; `{ ok:false, reason }` for
 *   `'join-invalid-datasets'` (a rows arg is not an array), `'join-keys-required'` (a key array is
 *   missing or empty), or `'join-keys-mismatch'` (key arrays have different lengths).
 *
 * @example
 *   const result = joinDatasets({
 *       leftRows: ordersDataset.rows,
 *       rightRows: customersDataset.rows,
 *       leftKeys: ['customerId'],
 *       rightKeys: ['id'],
 *       joinType: 'left',
 *       leftColumns: ['orderId', 'total'],
 *       rightColumns: ['name', 'country'],
 *       leftDatasetName: 'orders.csv',
 *       rightDatasetName: 'customers.csv',
 *   });
 *   // result.rows: [{ orderId: 1, total: 99, name: 'Ana', country: 'BR' }, …]
 *   // result.outputColumns: ['orderId', 'total', 'name', 'country']
 */
export function joinDatasets({
	leftRows,
	rightRows,
	leftKeys,
	rightKeys,
	joinType = 'inner',
	leftColumns,
	rightColumns,
	leftDatasetName,
	rightDatasetName,
	normalization = { trim: true, caseSensitive: false },
}) {
	if (!Array.isArray(leftRows) || !Array.isArray(rightRows)) {
		return fail('join-invalid-datasets');
	}

	if (!Array.isArray(leftKeys) || !Array.isArray(rightKeys) || leftKeys.length === 0 || rightKeys.length === 0) {
		return fail('join-keys-required');
	}

	if (leftKeys.length !== rightKeys.length) {
		return fail('join-keys-mismatch');
	}

	const normalizedJoinType = ['inner', 'left', 'right', 'full'].includes(joinType) ? joinType : 'inner';
	const selectedLeftColumns = Array.isArray(leftColumns) ? leftColumns : [];
	const selectedRightColumns = Array.isArray(rightColumns) ? rightColumns : [];

	const conflicts = new Set(selectedLeftColumns.filter(columnName => selectedRightColumns.includes(columnName)));
	const usedOutputNames = new Set();
	const leftPrefix = sanitizePrefix(leftDatasetName, 'left');
	const rightPrefix = sanitizePrefix(rightDatasetName, 'right');

	const leftColumnMap = selectedLeftColumns.map(columnName => {
		const baseName = conflicts.has(columnName) ? `${leftPrefix}.${columnName}` : columnName;
		return {
			source: columnName,
			output: ensureUniqueColumnName(baseName, usedOutputNames),
		};
	});

	const rightColumnMap = selectedRightColumns.map(columnName => {
		const baseName = conflicts.has(columnName) ? `${rightPrefix}.${columnName}` : columnName;
		return {
			source: columnName,
			output: ensureUniqueColumnName(baseName, usedOutputNames),
		};
	});

	const rightIndex = new Map();
	rightRows.forEach((row, rowIndex) => {
		const key = buildCompositeKey(row, rightKeys, normalization);
		const bucket = rightIndex.get(key) || [];
		bucket.push({ row, rowIndex });
		rightIndex.set(key, bucket);
	});

	const matchedRightIndices = new Set();
	const outputRows = [];

	const pushMergedRow = (leftRow, rightRow) => {
		const merged = {};

		leftColumnMap.forEach(({ source, output }) => {
			merged[output] = leftRow ? leftRow[source] : null;
		});

		rightColumnMap.forEach(({ source, output }) => {
			merged[output] = rightRow ? rightRow[source] : null;
		});

		outputRows.push(merged);
	};

	leftRows.forEach(leftRow => {
		const key = buildCompositeKey(leftRow, leftKeys, normalization);
		const matches = rightIndex.get(key) || [];

		if (matches.length > 0) {
			matches.forEach(({ row, rowIndex }) => {
				matchedRightIndices.add(rowIndex);
				pushMergedRow(leftRow, row);
			});
			return;
		}

		if (normalizedJoinType === 'left' || normalizedJoinType === 'full') {
			pushMergedRow(leftRow, null);
		}
	});

	if (normalizedJoinType === 'right' || normalizedJoinType === 'full') {
		rightRows.forEach((rightRow, rightIndexValue) => {
			if (matchedRightIndices.has(rightIndexValue)) return;
			pushMergedRow(null, rightRow);
		});
	}

	return ok({
		rows: outputRows,
		outputColumns: [
			...leftColumnMap.map(item => item.output),
			...rightColumnMap.map(item => item.output),
		],
	});
}
