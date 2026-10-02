import {
	TYPE_DETECTION,
	COLUMN_TYPES,
	TYPE_DEFAULTS,
	DECIMAL_DETECTION,
} from '../../config/columnTypeDetection.js';

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
 * Whether a value's only separator cannot be a thousands separator. A
 * thousands separator follows a leading group of one to three digits, so
 * "784431.551" (a 4+ digit leading group) and "0.358" (a single zero group)
 * indicate decimals. A padded group such as "01" is still ambiguous.
 *
 * @private
 * @param {string} value - A numeric-looking value containing `separator` and not the other one.
 * @param {'.' | ','} separator
 * @returns {boolean}
 */
function isUngroupedSingleSeparator(value, separator) {
	const integerPart = value.slice(0, value.lastIndexOf(separator)).replace(/^-/, '');
	if (!/^\d+$/.test(integerPart)) return false;
	return integerPart.length > 3 || integerPart === '0';
}

/**
 * Detect the decimal separator used in a dataset by inspecting a sample of raw values.
 *
 * Uses a three-stage heuristic:
 *   Stage 1: Values containing both separators - rightmost is decimal (unambiguous)
 *   Stage 2: Repeated thousands groups, or digit counts around a single separator
 *            (4+ leading digits or a single zero group indicate decimals)
 *   Stage 2b: Without clearer string evidence or typed fractions, treat an entirely
 *             whole-thousand dot sample ("1.000", "2.000") as European integers
 *   Stage 3: Post-detection NaN validation - if detected separator produces high NaN
 *            rate on numeric-looking values, try the other separator
 *
 * Other ambiguous dot triples ("6.358") fall back to dot. Typed numbers keep
 * their value and only supply a dot-decimal hint; explicit string evidence wins.
 *
 * @param {Array<string | number>} rawValues - Flat array of raw values from the dataset sample
 * @returns {'.' | ','} The detected decimal separator
 */
export function detectDecimalSeparator(rawValues) {
	const hasTypedFraction = rawValues.some(v =>
		typeof v === 'number' && Number.isFinite(v) && !Number.isInteger(v));

	// Filter to values that look like numbers: digits, dots, commas, optional leading minus
	const numericLike = rawValues
		.filter(v => typeof v === 'string')
		.map(v => v.trim())
		.filter(v => v.length > 0 && /^-?[\d.,]+$/.test(v));

	if (numericLike.length === 0) return '.';

	// Ambiguous dot triples must not outvote evidence from other strings. Both
	// decimal readings can parse successfully, so NaN validation cannot catch
	// a mistaken thousands interpretation that scales a measurement by 1000.
	let dotDecimalVotes = 0;
	let commaDecimalVotes = 0;
	let ambiguousDotValues = 0;
	let wholeThousandsDotValues = 0;

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

			if (/^-?\d{1,3}(?:\.\d{3}){2,}$/.test(value)) {
				// Multiple complete groups, unlike "6.358", establish thousands.
				commaDecimalVotes++;
			} else if (digitCount !== 3) {
				// 1, 2, or >3 digits after dot: likely decimal
				dotDecimalVotes++;
			} else if (isUngroupedSingleSeparator(value, '.')) {
				// Exactly 3 digits, but "784431.551" or "0.358" cannot be thousands.
				dotDecimalVotes++;
			} else if (/^-?\d{1,3}\.\d{3}$/.test(value)) {
				ambiguousDotValues++;
				if (/^-?[1-9]\d{0,2}\.000$/.test(value)) wholeThousandsDotValues++;
			}
			continue;
		}

		// Stage 2: Only comma present
		if (hasComma) {
			const afterComma = value.slice(value.lastIndexOf(',') + 1);
			const digitCount = afterComma.length;

			if (/^-?\d{1,3}(?:,\d{3}){2,}$/.test(value)) {
				dotDecimalVotes++;
			} else if (digitCount !== 3) {
				// 1, 2, or >3 digits after comma: likely decimal
				commaDecimalVotes++;
			} else if (isUngroupedSingleSeparator(value, ',')) {
				// Exactly 3 digits, but "784431,551" or "0,358" cannot be thousands.
				commaDecimalVotes++;
			}
			// Otherwise exactly 3 digits: ambiguous, skip
			// (no whole-number heuristic for comma - "1,000" is standard US thousands)
		}
	}

	// Stage 2b is a weak fallback for entirely whole-thousand samples. A
	// nonzero triple or a typed fraction keeps ambiguous dot decimals intact.
	let detected = commaDecimalVotes > dotDecimalVotes ? ',' : '.';
	if (dotDecimalVotes === 0 && commaDecimalVotes === 0 && !hasTypedFraction
		&& ambiguousDotValues > 0 && ambiguousDotValues === wholeThousandsDotValues) {
		detected = ',';
	}

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
