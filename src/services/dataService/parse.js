import { dsvFormat } from '../../../vendor/d3/d3.js';

/**
 * CHIVE file-parsing helpers.
 *
 * Pure functions for delimiter detection, CSV parsing (via d3's
 * `dsvFormat`), and JSON parsing with prototype-pollution hardening. No
 * DOM, no state, no I/O, safe to use in workers and tests.
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
 * @returns {Array<Object>} Parsed rows as plain objects
 */
export function parseCsv(text) {
	if (!text || text.trim().length === 0) {
		throw new Error('The CSV file is empty.');
	}

	const firstLine = text.split(/\r?\n/).find(line => line.trim().length > 0) || '';
	const delimiter = detectDelimiter(firstLine);
	const rows = dsvFormat(delimiter).parse(text);

	if (rows.columns) delete rows.columns;
	if (rows.length === 0) throw new Error('The CSV file is empty.');

	return rows;
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
 * @returns {Array<Object<string, *>>} Parsed rows.
 * @throws {Error} `'JSON file contains syntax errors…'`, `JSON.parse` failed.
 * @throws {Error} `'The JSON file is empty.'` / `'The data array in the JSON is empty.'`, zero rows.
 * @throws {Error} `'Unrecognized JSON format…'`, root is neither an array nor an object with an array-valued key.
 */
export function parseJson(text) {
	let parsed;

	try {
		parsed = JSON.parse(text);
	} catch {
		throw new Error('JSON file contains syntax errors. Verify the format.');
	}

	if (Array.isArray(parsed)) {
		if (parsed.length === 0) throw new Error('The JSON file is empty.');
		return stripDangerousKeys(parsed);
	}

	if (typeof parsed === 'object' && parsed !== null) {
		const chaveArray = Object.keys(parsed).find(chave => Array.isArray(parsed[chave]));
		if (chaveArray) {
			const arr = parsed[chaveArray];
			if (arr.length === 0) throw new Error('The data array in the JSON is empty.');
			return stripDangerousKeys(arr);
		}
	}

	throw new Error('Unrecognized JSON format. The file must be an array of objects: [{...}, {...}]');
}
