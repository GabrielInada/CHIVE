/**
 * CHIVE shared formatters and small predicates. Locale-aware number/date
 * formatting + HTML escaping + a handful of value-shape helpers used
 * everywhere.
 *
 * @typedef {import('../types.js').ColumnType} ColumnType
 */

import { getLocale, t } from '../services/i18nService.js';

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
 * Format a number with locale awareness and smart precision
 * @param {number} value - Number to format
 * @param {string} [locale] - Optional locale override (defaults to current locale)
 * @returns {string} - Formatted number string
 */
export function formatNumber(value, locale) {
	const numberValue = Number(value);
	if (value === null || value === undefined || value === '' || Number.isNaN(numberValue)) return 'N/A';

	const localeToUse = locale || getLocale();
	
	// Integer: no decimal places
	if (Number.isInteger(numberValue)) return numberValue.toLocaleString(localeToUse);
	
	// Large numbers (>= 100): 1 decimal place
	if (Math.abs(numberValue) >= 100) return numberValue.toLocaleString(localeToUse, { maximumFractionDigits: 1 });
	
	// Medium numbers (>= 1): 2 decimal places
	if (Math.abs(numberValue) >= 1) return numberValue.toLocaleString(localeToUse, { maximumFractionDigits: 2 });
	
	// Small numbers: 4 significant digits
	return numberValue.toPrecision(4);
}

/**
 * Translate a {@link ColumnType} code into its localized label. Unknown
 * codes pass through unchanged so the function never throws on legacy
 * data.
 *
 * @param {ColumnType | string} type
 * @returns {string}
 */
export function translateType(type) {
	if (type === 'number') return t('chive-type-number');
	if (type === 'text') return t('chive-type-text');
	if (type === 'date') return t('chive-type-date');
	return type;
}

/**
 * Format a date with locale awareness. Accepts Date instances or
 * date-parseable strings (ISO is the canonical CHIVE shape after ingest).
 * Returns '' for nullish/invalid values.
 * @param {Date|string|number|null|undefined} value
 * @param {string} [locale] - Optional locale override
 * @param {Intl.DateTimeFormatOptions} [options] - Override formatter options
 * @returns {string}
 */
export function formatDate(value, locale, options) {
	if (value === null || value === undefined || value === '') return '';
	const date = value instanceof Date ? value : new Date(value);
	if (!Number.isFinite(date.getTime())) return '';
	const localeToUse = locale || getLocale();
	const formatOptions = options || { year: 'numeric', month: 'short', day: '2-digit' };
	return new Intl.DateTimeFormat(localeToUse, formatOptions).format(date);
}
