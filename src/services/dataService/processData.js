import { DECIMAL_DETECTION } from '../../config/types.js';
import { detectDecimalSeparator, detectType, normalizeNumericString } from './typeDetection.js';

/**
 * CHIVE row-normalization pipeline.
 *
 * Detects column types and decimal convention once per dataset, then
 * parses numeric cells into actual numbers. Pure, safe to use in workers
 * and tests.
 *
 * @typedef {import('../../types.js').ColumnSpec} ColumnSpec
 */

/**
 * Detect column types and normalize numeric values in a single pass.
 *
 * The decimal separator is detected once for the whole dataset (it is a
 * file-level property, all numeric columns in one upload share the same
 * convention). Then each column gets a `type` from `detectType`, and
 * numeric cells are parsed into actual numbers via `normalizeNumericString`.
 *
 * @param {Array<Object<string, *>>} rawData - Rows as produced by `parseCsv` or `parseJson`.
 * @returns {{ rows: Array<Object<string, *>>, columns: ColumnSpec[] }} - `rows` is the normalized row set; `columns` lists `{ name, type }` in source order. Empty input returns empty arrays.
 * @throws {Error} When `rawData` is not an array.
 */
export function processData(rawData) {
	if (!Array.isArray(rawData)) {
		throw new Error('rawData must be an array');
	}

	if (rawData.length === 0) {
		return { rows: [], columns: [] };
	}

	// Detect decimal separator once from a flat sample of all raw values.
	// This is a dataset-level property - all numeric columns in a single file
	// will use the same decimal convention.
	const allRawValues = rawData
		.slice(0, DECIMAL_DETECTION.sampleSize)
		.flatMap(row => Object.values(row))
		.map(v => String(v ?? '').trim())
		.filter(v => v.length > 0);
	const decimalSeparator = detectDecimalSeparator(allRawValues);

	const columnNames = Object.keys(rawData[0]);

	const columns = columnNames.map(name => {
		const values = rawData.map(row => row[name]);
		return { name: name, type: detectType(values, decimalSeparator) };
	});

	const rows = rawData.map(row => {
		const convertedRow = {};

		columns.forEach(({ name: name, type }) => {
			const value = row[name];
			if (type === 'number' && value !== '' && value !== null && value !== undefined) {
				const normalized = normalizeNumericString(String(value), decimalSeparator);
				convertedRow[name] = Number(normalized);
			} else {
				convertedRow[name] = value;
			}
		});

		return convertedRow;
	});

	return { rows: rows, columns: columns };
}
