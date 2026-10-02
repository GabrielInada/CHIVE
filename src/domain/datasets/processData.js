import { DECIMAL_DETECTION } from '../../config/columnTypeDetection.js';
import { toCanonicalCell } from './cellValues.js';
import { detectDecimalSeparator, detectType } from './typeDetection.js';

/**
 * CHIVE row-normalization pipeline.
 *
 * Detects column types and decimal convention once per dataset, then
 * brings every cell to its column type's canonical form. Pure, safe to use
 * in workers and tests.
 *
 * @typedef {import('../../types.js').ColumnSpec} ColumnSpec
 */

/**
 * Detect column types and canonicalize every cell in a single pass.
 *
 * The decimal separator is specified or detected once for the whole dataset (it is a
 * file-level property, all numeric columns in one upload share the same
 * convention). Then each column gets a `type` from `detectType`, and each
 * cell takes that type's canonical form via `toCanonicalCell`.
 *
 * @param {Array<Object<string, *>>} rawData - The rows from a `parseCsv`/`parseJson` result (`result.rows`).
 * @param {{ decimalSeparator?: 'auto' | '.' | ',' }} [options] - Use an explicit separator for ambiguous input such as European grouped integers.
 * @returns {{ rows: Array<Object<string, *>>, columns: ColumnSpec[] }} - Columns retain their decimal format for strings that a later join may classify as numeric. Empty input returns empty arrays.
 * @throws {Error} When `rawData` is not an array.
 */
export function processData(rawData, options = {}) {
	if (!Array.isArray(rawData)) {
		throw new Error('rawData must be an array');
	}

	if (rawData.length === 0) {
		return { rows: [], columns: [] };
	}

	// Detect decimal separator once from a flat sample of all raw values.
	// This is a dataset-level property - all numeric columns in a single file
	// will use the same decimal convention.
	// Only strings provide locale evidence; the detector ignores typed numbers.
	const allRawValues = rawData
		.slice(0, DECIMAL_DETECTION.sampleSize)
		.flatMap(row => Object.values(row));
	const decimalSeparator = detectDecimalSeparator(allRawValues, options.decimalSeparator);

	const columnNames = Object.keys(rawData[0]);

	const columns = columnNames.map(name => {
		const values = rawData.map(row => row[name]);
		return { name: name, type: detectType(values, decimalSeparator), decimalSeparator };
	});

	const cellOptions = { decimalSeparator };
	const rows = rawData.map(row => {
		const convertedRow = {};

		columns.forEach(({ name, type }) => {
			convertedRow[name] = toCanonicalCell(row[name], type, cellOptions);
		});

		return convertedRow;
	});

	return { rows: rows, columns: columns };
}
