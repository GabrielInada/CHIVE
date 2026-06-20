import { TYPE_DETECTION, COLUMN_TYPES, TYPE_DEFAULTS, DECIMAL_DETECTION } from '../../config/types.js';

/**
 * CHIVE type- and decimal-detection helpers.
 *
 * Pure functions for normalizing numeric strings, detecting a dataset's
 * decimal separator, and classifying a column's type from a sample. No
 * DOM, no state, no I/O, safe to use in workers and tests.
 */

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
