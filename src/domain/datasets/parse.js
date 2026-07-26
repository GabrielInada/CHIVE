import { dsvFormat } from '../../../vendor/d3/d3.js';
import { ok, fail } from '../../utils/result.js';

/**
 * CHIVE file-parsing helpers.
 *
 * Pure functions for delimiter detection, CSV parsing (via d3's
 * `dsvFormat`), and JSON parsing with prototype-pollution hardening. No
 * DOM, no state, no I/O, safe to use in workers and tests.
 *
 * `parseCsv`/`parseJson` return a {@link Result}: `ok({ rows })` on success,
 * `fail(reason)` with a stable reason code on failure (the worker maps the
 * reason to a localized message).
 *
 * @typedef {import('../../types.js').Result} Result
 */

/**
 * Detect the delimiter used in a delimited text file by inspecting the first line.
 * Counts occurrences of each candidate delimiter and returns the one with the highest count.
 * In case of a tie, priority order is: comma → semicolon → tab → pipe.
 *
 * @param {string} firstLine - The first non-empty line of the file content
 * @returns {string} The detected delimiter character
 */
export function detectDelimiter(firstLine) {
	const candidates = [',', ';', '\t', '|'];
	const scores = candidates.map(delimiter => ({
		delimiter,
		count: firstLine.split(delimiter).length - 1,
	}));

	// Find the maximum count
	const maxCount = Math.max(...scores.map(s => s.count));

	// If nothing scored, fall back to comma
	if (maxCount === 0) return ',';

	// Return the first (highest-priority) delimiter that achieved the max count
	return scores.find(s => s.count === maxCount).delimiter;
}

/**
 * Parse a delimited text file with automatic delimiter detection.
 * Inspects the first line to detect the delimiter, then parses the full content.
 *
 * @param {string} text - Full file content as a string
 * @returns {Result} `ok({ rows })` with parsed rows as plain objects, or `fail('csv-empty')`.
 */
export function parseCsv(text) {
	if (!text || text.trim().length === 0) {
		return fail('csv-empty');
	}

	const firstLine = text.split(/\r?\n/).find(line => line.trim().length > 0) || '';
	const delimiter = detectDelimiter(firstLine);
	const rows = dsvFormat(delimiter).parse(text);

	if (rows.columns) delete rows.columns;
	if (rows.length === 0) return fail('csv-empty');

	return ok({ rows });
}

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Defense-in-depth against prototype pollution: JSON.parse does not
 * pollute Object.prototype, but the parsed value can carry
 * `__proto__`/`constructor`/`prototype` as own enumerable keys, which
 * would leak through any downstream Object.assign / spread / recursive
 * merge. Recursively strips them.
 *
 * @private
 */
function stripDangerousKeys(value) {
	if (Array.isArray(value)) {
		return value.map(stripDangerousKeys);
	}
	if (value !== null && typeof value === 'object') {
		const cleaned = {};
		for (const [key, val] of Object.entries(value)) {
			if (DANGEROUS_KEYS.has(key)) continue;
			cleaned[key] = stripDangerousKeys(val);
		}
		return cleaned;
	}
	return value;
}

/**
 * Parse a JSON file's content into an array of row objects.
 *
 * Accepted shapes:
 *   - Top-level array: `[{...}, {...}]` → returned as-is.
 *   - Object with one array-valued key: `{ items: [{...}] }` → the first
 *     array-valued key wins (object key order, not name).
 *
 * Dangerous keys (`__proto__`, `constructor`, `prototype`) are stripped
 * recursively from every row.
 *
 * @param {string} text - Raw file content.
 * @returns {Result} `ok({ rows })` with parsed rows, or `fail(reason)` with one of:
 *   `'json-syntax'` (`JSON.parse` failed), `'json-empty'` (top-level array is empty),
 *   `'json-array-empty'` (the array-valued key holds zero rows), `'json-unrecognized'`
 *   (root is neither an array nor an object with an array-valued key).
 */
export function parseJson(text) {
	let parsed;

	try {
		parsed = JSON.parse(text);
	} catch {
		return fail('json-syntax');
	}

	if (Array.isArray(parsed)) {
		if (parsed.length === 0) return fail('json-empty');
		return ok({ rows: stripDangerousKeys(parsed) });
	}

	if (typeof parsed === 'object' && parsed !== null) {
		const arrayKey = Object.keys(parsed).find(key => Array.isArray(parsed[key]));
		if (arrayKey) {
			const arr = parsed[arrayKey];
			if (arr.length === 0) return fail('json-array-empty');
			return ok({ rows: stripDangerousKeys(arr) });
		}
	}

	return fail('json-unrecognized');
}
