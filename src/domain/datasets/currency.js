import { detectDecimalSeparator, normalizeNumericString } from './typeDetection.js';

// The fallback keeps explicit currency selection usable on older engines.
const FALLBACK_CODES = 'AED ARS AUD BHD BRL CAD CHF CLP CNY COP CZK DKK EUR GBP HKD HUF IDR ILS INR JPY KRW KWD MXN MYR NOK NZD PEN PHP PLN RUB SAR SEK SGD THB TRY TWD UAH USD UYU VND ZAR'.split(' ');
const codes = new Set(typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('currency') : FALLBACK_CODES);
const symbols = new Map([
	['R$', ['BRL']], ['US$', ['USD']], ['CA$', ['CAD']], ['C$', ['CAD']],
	['AU$', ['AUD']], ['A$', ['AUD']], ['NZ$', ['NZD']], ['HK$', ['HKD']], ['S$', ['SGD']],
	['€', ['EUR']], ['£', ['GBP']], ['₹', ['INR']], ['₩', ['KRW']], ['₽', ['RUB']],
	['₺', ['TRY']], ['₴', ['UAH']], ['₫', ['VND']],
	['$', ['USD', 'CAD', 'AUD', 'NZD', 'MXN', 'ARS', 'CLP', 'COP', 'UYU', 'HKD', 'SGD', 'TWD']],
	['¥', ['JPY', 'CNY']], ['￥', ['JPY', 'CNY']],
]);
const tokenPattern = '(?:US\\$|CA\\$|AU\\$|NZ\\$|HK\\$|[RACS]\\$|[A-Z]{3}|[$€£¥￥₹₩₽₺₴₫])';
const prefix = new RegExp(`^${tokenPattern}`, 'i');
const suffix = new RegExp(`${tokenPattern}$`, 'i');

/** Supported ISO currency codes for detection and the column-format picker. */
export function getCurrencyCodes() {
	return [...codes].sort();
}

function tokenCurrencies(token) {
	const upper = token.toUpperCase();
	return symbols.get(upper) ?? (codes.has(upper) ? [upper] : []);
}

/** Split only edge currency tokens; never strip arbitrary letters from data. */
function parts(raw) {
	if (raw === null || raw === undefined || String(raw).trim() === '') return { missing: true, markers: [] };
	if (typeof raw === 'number') return { amount: raw, markers: [] };
	let amount = String(raw).trim();
	let negative = false;
	if (amount.startsWith('(') && amount.endsWith(')')) {
		negative = true;
		amount = amount.slice(1, -1).trim();
	}
	let sign = '';
	if (/^[+-]/.test(amount)) {
		sign = amount[0];
		amount = amount.slice(1).trim();
	}
	const markers = [];
	const leading = prefix.exec(amount);
	const leadingIsCode = leading && /^[a-z]{3}$/i.test(leading[0]);
	if (leading && tokenCurrencies(leading[0]).length
		&& (!leadingIsCode || /^\s*[+-]?\s*[\d.,]/.test(amount.slice(leading[0].length)))) {
		markers.push(tokenCurrencies(leading[0]));
		amount = amount.slice(leading[0].length).trim();
	}
	const trailing = suffix.exec(amount);
	const trailingIsCode = trailing && /^[a-z]{3}$/i.test(trailing[0]);
	if (trailing && tokenCurrencies(trailing[0]).length
		&& (!trailingIsCode || /[\d.,]\s*$/.test(amount.slice(0, -trailing[0].length)))) {
		markers.push(tokenCurrencies(trailing[0]));
		amount = amount.slice(0, -trailing[0].length).trim();
	}
	// A second sign or a sign inside accounting parentheses is invalid.
	if ((sign || negative) && /^[+-]/.test(amount)) amount = `invalid:${amount}`;
	if (negative && sign) amount = `invalid:${amount}`;
	return { amount: `${negative ? '-' : sign}${amount}`, markers };
}

function withoutSpaceGroups(text) {
	return typeof text === 'string' && /^[+-]?\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:[.,]\d+)?$/.test(text)
		? text.replace(/[ \u00a0\u202f]/g, '') : text;
}

function readAmount(part, currency, decimalSeparator) {
	if (part.missing) return null;
	if (part.markers.some(candidates => !candidates.includes(currency))) return null;
	if (typeof part.amount === 'number') return Number.isFinite(part.amount) ? part.amount : null;
	// Spaces are grouping only when they form complete groups of three.
	const text = withoutSpaceGroups(part.amount);
	const numeric = decimalSeparator === ','
		? /^[+-]?(?:(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?|,\d+)$/
		: /^[+-]?(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?|\.\d+)$/;
	if (!numeric.test(text)) return null;
	const number = Number(normalizeNumericString(text, decimalSeparator));
	return Number.isFinite(number) ? number : null;
}

/** Parse a monetary cell using a known currency and source decimal convention. */
export function parseCurrencyValue(raw, { currency, decimalSeparator = '.' }) {
	if (!codes.has(currency)) return null;
	return readAmount(parts(raw), currency, decimalSeparator);
}

/**
 * Inspect the entire column before committing to one currency. Null means no
 * currency evidence. Unresolved columns stay text, including their original
 * markers, so neither mixed currencies nor malformed amounts become nulls.
 * Explicit currency resolves ambiguous symbols, never conflicting codes.
 */
export function analyzeCurrencyColumn(values, { currency, decimalSeparator = 'auto' } = {}) {
	const parsed = values.map(parts);
	const markers = parsed.flatMap(part => part.markers);
	if (!currency && markers.length === 0) return null;
	let candidates = currency ? [currency] : markers[0];
	for (const marker of markers) candidates = candidates.filter(code => marker.includes(code));
	if (candidates.length !== 1 || !codes.has(candidates[0])) {
		return { type: 'text', currencyIssue: candidates.length > 1 ? 'ambiguous' : 'mixed' };
	}
	const resolved = candidates[0];
	const amounts = parsed.map(part => {
		const amount = withoutSpaceGroups(part.amount);
		return typeof amount === 'string' ? amount.replace(/^\+/, '') : amount;
	});
	const separated = amounts.filter(amount => typeof amount === 'string' && /[.,]/.test(amount));
	// "1.000" can mean one or one thousand, even when the currency is known.
	if (decimalSeparator === 'auto' && separated.length > 0
		&& separated.every(amount => /^-?(?!0[.,])\d{1,3}[.,]\d{3}$/.test(amount))) {
		return { type: 'text', currencyIssue: 'ambiguous' };
	}
	let separator = detectDecimalSeparator(amounts, decimalSeparator);
	const acceptsColumn = candidate => parsed.every(part => part.missing || readAmount(part, resolved, candidate) !== null);
	if (!acceptsColumn(separator)) {
		// The generic detector's NaN heuristic can mistake grouped integers for
		// decimals. Only accept an alternative that strictly parses every amount.
		const alternate = separator === '.' ? ',' : '.';
		if (decimalSeparator !== 'auto' || !acceptsColumn(alternate)) return { type: 'text', currencyIssue: 'invalid' };
		separator = alternate;
	}
	return { type: 'number', currency: resolved, decimalSeparator: separator };
}

/**
 * Prepare an atomic column edit. No cells are discarded on a failed edit;
 * numeric cells keep their amount when only their currency label changes.
 */
export function prepareCurrencyChange(rows, column, { currency, decimalSeparator = 'auto' }) {
	const nextColumn = { ...column };
	delete nextColumn.currency;
	if (!currency) return { ok: true, column: nextColumn, rows };
	const values = rows.map(row => row[column.name]);
	const format = analyzeCurrencyColumn(values, { currency, decimalSeparator });
	if (!format?.currency) return { ok: false, reason: format?.currencyIssue || 'invalid' };
	delete nextColumn.currencyIssue;
	Object.assign(nextColumn, format);
	const nextRows = rows.map(row => {
		const amount = parseCurrencyValue(row[column.name], format);
		return Object.is(amount, row[column.name]) ? row : { ...row, [column.name]: amount };
	});
	return { ok: true, column: nextColumn, rows: nextRows };
}
