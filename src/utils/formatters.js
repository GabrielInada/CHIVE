/**
 * CHIVE shared formatters and small predicates. Locale-aware number/date
 * formatting + HTML escaping + a handful of value-shape helpers used
 * everywhere.
 */

/**
 * `true` for `null` and `undefined` only. Distinct from
 * {@link isEmptyValue}, which also returns `true` for blank strings.
 *
 * @param {*} value
 * @returns {boolean}
 */
export function isNullish(value) {
	return value === null || value === undefined;
}

/**
 * `true` for `null`, `undefined`, or strings that are blank after trimming.
 * Used to detect "missing" cells in user data.
 *
 * @param {*} value
 * @returns {boolean}
 */
export function isEmptyValue(value) {
	return value === null || value === undefined || String(value).trim() === '';
}

/**
 * Coerce a raw cell value to a finite number, treating missing values as
 * absent rather than zero. `Number('')` and `Number(null)` are both `0`, so a
 * blank cell in a numeric column would otherwise become a real datum at the
 * origin and blow out axis extents.
 *
 * @param {*} value
 * @returns {number} The finite number, or `NaN` when missing or unparseable.
 */
export function toFiniteNumber(value) {
	if (isEmptyValue(value)) return NaN;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : NaN;
}

/**
 * Clamp a number to `[min, max]`. Does not validate that `min <= max`.
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max);
}

/**
 * Escape HTML special characters to prevent injection
 * @param {*} text - Value to escape
 * @returns {string} - Escaped HTML string
 */
export function escapeHtml(text) {
	return String(text)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
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

/**
 * Format a number with locale awareness and smart precision
 * @param {number} value - Number to format
 * @param {string} locale - Active app locale (e.g. 'en-US'). Required by convention — callers pass it explicitly so this stays pure (no global-state read).
 * @returns {string} - Formatted number string
 */
export function formatNumber(value, locale) {
	const numberValue = Number(value);
	if (value === null || value === undefined || value === '' || Number.isNaN(numberValue)) return 'N/A';

	// Integer: no decimal places
	if (Number.isInteger(numberValue)) return numberValue.toLocaleString(locale);

	// Large numbers (>= 100): 1 decimal place
	if (Math.abs(numberValue) >= 100) return numberValue.toLocaleString(locale, { maximumFractionDigits: 1 });

	// Medium numbers (>= 1): 2 decimal places
	if (Math.abs(numberValue) >= 1) return numberValue.toLocaleString(locale, { maximumFractionDigits: 2 });

	// Small numbers: 4 significant digits
	return numberValue.toPrecision(4);
}

/**
 * Format a date with locale awareness. Accepts Date instances or
 * date-parseable strings (ISO is the canonical CHIVE shape after ingest).
 * Returns '' for nullish/invalid values.
 * @param {Date|string|number|null|undefined} value
 * @param {string} locale - Active app locale. Required by convention — callers pass it explicitly so this stays pure (no global-state read).
 * @param {Intl.DateTimeFormatOptions} [options] - Override formatter options
 * @returns {string}
 */
export function formatDate(value, locale, options) {
	if (value === null || value === undefined || value === '') return '';
	const date = value instanceof Date ? value : new Date(value);
	if (!Number.isFinite(date.getTime())) return '';
	const formatOptions = options || { year: 'numeric', month: 'short', day: '2-digit' };
	return new Intl.DateTimeFormat(locale, formatOptions).format(date);
}
