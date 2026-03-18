import { obterLocale } from '../services/i18nService.js';

/**
 * Escape HTML special characters to prevent injection
 * @param {*} texto - Value to escape
 * @returns {string} - Escaped HTML string
 */
export function escaparHTML(texto) {
	return String(texto)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

/**
 * Format a number with locale awareness and smart precision
 * @param {number} valor - Number to format
 * @param {string} [locale] - Optional locale override (defaults to current locale)
 * @returns {string} - Formatted number string
 */
export function formatarNumero(valor, locale) {
	const numero = Number(valor);
	if (valor === null || valor === undefined || valor === '' || Number.isNaN(numero)) return '—';

	const localeToUse = locale || obterLocale();
	
	// Integer: no decimal places
	if (Number.isInteger(numero)) return numero.toLocaleString(localeToUse);
	
	// Large numbers (>= 100): 1 decimal place
	if (Math.abs(numero) >= 100) return numero.toLocaleString(localeToUse, { maximumFractionDigits: 1 });
	
	// Medium numbers (>= 1): 2 decimal places
	if (Math.abs(numero) >= 1) return numero.toLocaleString(localeToUse, { maximumFractionDigits: 2 });
	
	// Small numbers: 4 significant digits
	return numero.toPrecision(4);
}
