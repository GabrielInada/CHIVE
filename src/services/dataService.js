import { dsvFormat, max, mean, median, min } from '../../vendor/d3/d3.js';
import { TYPE_DETECTION, COLUMN_TYPES, TYPE_DEFAULTS, DECIMAL_DETECTION } from '../config/types.js';
import { isNullish } from '../utils/formatters.js';

/**
 * CHIVE data service.
 *
 * Pure functions for CSV/JSON parsing, type/decimal detection, row
 * normalization, dataset joins, and per-column statistics. No DOM, no
 * state, no I/O, safe to use in workers and tests.
 *
 * @typedef {import('../types.js').ColumnSpec} ColumnSpec
 * @typedef {import('../types.js').JoinDatasetsOptions} JoinDatasetsOptions
 * @typedef {import('../types.js').JoinResult} JoinResult
 * @typedef {import('../types.js').NumericColumnStats} NumericColumnStats
 * @typedef {import('../types.js').CategoricalColumnStats} CategoricalColumnStats
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
 * @returns {JoinResult}
 * @throws {Error} `'join-invalid-datasets'`, `leftRows` or `rightRows` is not an array.
 * @throws {Error} `'join-keys-required'`, either key array is missing or empty.
 * @throws {Error} `'join-keys-mismatch'`, key arrays have different lengths.
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
		throw new Error('join-invalid-datasets');
	}

	if (!Array.isArray(leftKeys) || !Array.isArray(rightKeys) || leftKeys.length === 0 || rightKeys.length === 0) {
		throw new Error('join-keys-required');
	}

	if (leftKeys.length !== rightKeys.length) {
		throw new Error('join-keys-mismatch');
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

	return {
		rows: outputRows,
		outputColumns: [
			...leftColumnMap.map(item => item.output),
			...rightColumnMap.map(item => item.output),
		],
	};
}

/**
 * Normalize a raw numeric string to a form parseable by Number().
 * Removes thousands separators and converts the decimal separator to dot.
 *
 * @param {string} value - Raw string value from the parsed file
 * @param {string} decimalSeparator - The detected decimal separator: '.' or ','
 * @returns {string} Normalized string ready for Number()
 */
export function normalizeNumericString(value, decimalSeparator) {
	if (decimalSeparator === ',') {
		// Comma is decimal: dot is thousands separator
		// Remove all dots (thousands), replace comma with dot (decimal)
		return value.replace(/\./g, '').replace(',', '.');
	}
	// Dot is decimal: comma is thousands separator
	// Remove all commas (thousands), dot is already correct for Number()
	return value.replace(/,/g, '');
}

/**
 * Detect the decimal separator used in a dataset by inspecting a sample of raw values.
 *
 * Uses a three-stage heuristic:
 *   Stage 1: Values containing both separators - rightmost is decimal (unambiguous)
 *   Stage 2: Structural digit-count after the single separator
 *   Stage 2b: Whole-number thousands heuristic for European integers like "1.000"
 *   Stage 3: Post-detection NaN validation - if detected separator produces high NaN
 *            rate on numeric-looking values, try the other separator
 *
 * Falls back to '.' (dot) in all ambiguous or empty cases.
 *
 * @param {string[]} rawValues - Flat array of raw string values from the dataset sample
 * @returns {'.' | ','} The detected decimal separator
 */
export function detectDecimalSeparator(rawValues) {
	// Filter to values that look like numbers: digits, dots, commas, optional leading minus
	const numericLike = rawValues
		.map(v => String(v ?? '').trim())
		.filter(v => v.length > 0 && /^-?[\d.,]+$/.test(v));

	if (numericLike.length === 0) return '.';

	// WHY: stages are ordered so each handles a different international-format gotcha.
	// Stage 1 (both separators) is unambiguous → trust the position. Stage 2 (one
	// separator) uses digit-count heuristics, with Stage 2b ("1.000") catching the
	// classic European-thousands trap. Stage 3 (NaN-rate validation) is the safety
	// net for the rare case where the votes were misleading. Reordering breaks
	// real-world data.
	let dotDecimalVotes = 0;
	let commaDecimalVotes = 0;

	for (const value of numericLike) {
		const hasDot = value.includes('.');
		const hasComma = value.includes(',');

		// Stage 1: Both separators present - unambiguous vote
		if (hasDot && hasComma) {
			if (value.lastIndexOf(',') > value.lastIndexOf('.')) {
				commaDecimalVotes++;
			} else {
				dotDecimalVotes++;
			}
			continue;
		}

		// Stage 2 + 2b: Only dot present
		if (hasDot) {
			const afterDot = value.slice(value.lastIndexOf('.') + 1);
			const digitCount = afterDot.length;

			if (digitCount !== 3) {
				// 1, 2, or >3 digits after dot: likely decimal
				dotDecimalVotes++;
			} else {
				// Exactly 3 digits after dot
				// Stage 2b: "1.000" pattern - dot is thousands, so comma would be decimal
				if (/^\d{1,3}\.\d{3}$/.test(value)) {
					commaDecimalVotes++;
				}
				// Otherwise skip - genuinely ambiguous
			}
			continue;
		}

		// Stage 2: Only comma present
		if (hasComma) {
			const afterComma = value.slice(value.lastIndexOf(',') + 1);
			const digitCount = afterComma.length;

			if (digitCount !== 3) {
				// 1, 2, or >3 digits after comma: likely decimal
				commaDecimalVotes++;
			}
			// Exactly 3 digits: ambiguous, skip
			// (no whole-number heuristic for comma - "1,000" is standard US thousands)
		}
	}

	// Determine winner from votes
	const detected = commaDecimalVotes > dotDecimalVotes ? ',' : '.';

	// Stage 3: NaN validation fallback
	// If the detected separator produces a high NaN rate on the sample,
	// try the other separator and switch if it performs better.
	const parseForValidation = (value, sep) => {
		const hasDot = value.includes('.');
		const hasComma = value.includes(',');

		if (sep === '.') {
			if (hasDot && hasComma) {
				return Number(value.replace(/,/g, ''));
			}
			if (hasComma && !hasDot) {
				// Conservative validation: comma-only values are not dot-decimal by shape.
				return Number(value);
			}
			return Number(value);
		}

		if (hasDot && hasComma) {
			return Number(value.replace(/\./g, '').replace(',', '.'));
		}
		if (hasComma && !hasDot) {
			return Number(value.replace(',', '.'));
		}
		return Number(value);
	};

	const nanRate = (sep) => {
		const results = numericLike.map(v => parseForValidation(v, sep));
		const nanCount = results.filter(n => isNaN(n)).length;
		return nanCount / results.length;
	};

	const detectedNanRate = nanRate(detected);
	if (detectedNanRate > DECIMAL_DETECTION.nanRateThreshold) {
		const other = detected === '.' ? ',' : '.';
		const otherNanRate = nanRate(other);
		if (otherNanRate < detectedNanRate) {
			return other;
		}
	}

	return detected;
}

/**
 * Detect the data type of a column from a sample of its raw values.
 *
 * @param {Array} values - Raw values from the column
 * @param {string} [decimalSeparator='.'] - Decimal separator to use when testing numeric parsing
 * @returns {string} Column type constant from COLUMN_TYPES
 */
export function detectType(values, decimalSeparator = '.') {
	const validValues = values
		.slice(0, TYPE_DETECTION.sampleSize)
		.filter(v => v !== null && v !== undefined && String(v).trim() !== '');

	if (validValues.length === 0) return TYPE_DEFAULTS.fallback;

	const totalNumbers = validValues.filter(v => {
		const normalized = normalizeNumericString(String(v), decimalSeparator);
		return !isNaN(Number(normalized));
	}).length;
	if (totalNumbers / validValues.length >= TYPE_DETECTION.numberThreshold) return COLUMN_TYPES.NUMBER;

	const totalDates = validValues.filter(v => !isNaN(Date.parse(v))).length;
	if (totalDates / validValues.length >= TYPE_DETECTION.dateThreshold) return COLUMN_TYPES.DATE;

	return TYPE_DEFAULTS.fallback;
}

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

/**
 * Compute per-column numeric statistics (n, min, max, mean, median).
 * Columns with `type !== 'number'` are skipped; numeric columns with no
 * finite values are also skipped (the function does not return null
 * placeholders).
 *
 * @param {Array<Object<string, *>>} rows
 * @param {ColumnSpec[]} columns
 * @returns {NumericColumnStats[]}
 */
export function calculateStatistics(rows, columns) {
	return columns
		.filter(column => column.type === 'number')
		.map(({ name }) => {
			const values = rows
				.map(row => row[name])
				.filter(value => value !== null && value !== undefined && !isNaN(value));

			if (values.length === 0) return null;

			return {
				name,
				n: values.length,
				min: min(values),
				max: max(values),
				mean: mean(values),
				median: median(values),
			};
		})
		.filter(Boolean);
}

/**
 * Treat null, undefined, and whitespace-only strings as missing.
 *
 * @private
 */
function isMissingValue(value) {
	if (isNullish(value)) return true;
	if (typeof value === 'string' && value.trim() === '') return true;
	return false;
}

/**
 * Compute per-column categorical statistics (mode, top-5 share,
 * missingness) for every non-numeric column. Columns where every value
 * is missing return `empty: true` with zeroed counts so renderers can
 * draw a uniform "no data" state.
 *
 * @param {Array<Object<string, *>>} rows
 * @param {ColumnSpec[]} columns
 * @returns {CategoricalColumnStats[]} One entry per non-numeric column, in source order.
 */
export function calculateCategoricalStatistics(rows, columns) {
	return columns
		.filter(column => column.type !== 'number')
		.map(({ name }) => {
			const counts = new Map();
			let missing = 0;
			let n = 0;

			for (let i = 0; i < rows.length; i++) {
				const value = rows[i]?.[name];
				if (isMissingValue(value)) {
					missing++;
					continue;
				}
				const key = String(value);
				counts.set(key, (counts.get(key) || 0) + 1);
				n++;
			}

			const total = n + missing;
			const unique = counts.size;

			if (n === 0) {
				return {
					name,
					n: 0,
					missing,
					missingPct: total > 0 ? missing / total : 0,
					unique: 0,
					uniquenessRate: 0,
					mode: null,
					modeCount: 0,
					modePct: 0,
					top5Pct: 0,
					empty: true,
				};
			}

			let mode = null;
			let modeCount = 0;
			for (const [key, count] of counts) {
				if (count > modeCount || (count === modeCount && (mode === null || key.localeCompare(mode) < 0))) {
					mode = key;
					modeCount = count;
				}
			}

			const top5Sum = Array.from(counts.values())
				.sort((a, b) => b - a)
				.slice(0, 5)
				.reduce((sum, c) => sum + c, 0);

			return {
				name,
				n,
				missing,
				missingPct: total > 0 ? missing / total : 0,
				unique,
				uniquenessRate: n > 0 ? unique / n : 0,
				mode,
				modeCount,
				modePct: n > 0 ? modeCount / n : 0,
				top5Pct: n > 0 ? top5Sum / n : 0,
				empty: false,
			};
		});
}

/**
 * Format a byte count as a human-readable label. Three tiers:
 *   - `< 1 KB`  → `"<N> B"`
 *   - `< 1 MB`  → `"<N.N> KB"` (1 decimal)
 *   - otherwise → `"<N.N> MB"` (1 decimal)
 *
 * @param {number} sizeBytes
 * @returns {string}
 */
export function formatFileSize(sizeBytes) {
	if (sizeBytes < 1024) return `${sizeBytes} B`;
	if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
	return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
