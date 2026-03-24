import { getLocale } from '../services/i18nService.js';

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
	if (value === null || value === undefined || value === '' || Number.isNaN(numberValue)) return '—';

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
