/**
 * CHIVE i18n service.
 *
 * Thin wrapper around banana-i18n. Loads `pt-BR` and `en` message
 * bundles at import time, exposes `t()` for translations, and provides
 * a `setLocale` that persists the choice, re-translates the static
 * page, and broadcasts a `'chive-locale-changed'` CustomEvent on
 * `window` so dynamic UI can refresh.
 */

import Banana from '../../vendor/banana-i18n/banana-i18n.js';
import ptBR from '../i18n/pt-BR.json' with { type: 'json' };
import en from '../i18n/en.json' with { type: 'json' };
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, LOCALE_STORAGE_KEY } from '../config/locale.js';

const LOCALES = SUPPORTED_LOCALES;
const LOCALE_KEY = LOCALE_STORAGE_KEY;

const LOCALE_LABELS = {
	'pt-BR': 'Português',
	'en': 'English',
};

const banana = new Banana(DEFAULT_LOCALE);
banana.load(ptBR, 'pt-BR');
banana.load(en, 'en');

/**
 * Translate a message key. Supports banana-i18n positional substitution
 * (`$1`, `$2`, …) and inline plural markup (`{{PLURAL:$1|one|other}}`).
 *
 * @param {string} key - Message key as declared in `src/i18n/<locale>.json`.
 * @param {...*} params - Positional substitutions for `$1`, `$2`, …
 * @returns {string} The translated string. Falls back to `key` itself when the message is missing.
 */
export function t(key, ...params) {
	return banana.i18n(key, ...params);
}

/**
 * Translate a column-type code (`'number'`, `'text'`, `'date'`) into its
 * localized label. Unknown codes pass through unchanged so the function
 * never throws on legacy data.
 *
 * @param {import('../types.js').ColumnType | string} type
 * @returns {string}
 */
export function translateType(type) {
	if (type === 'number') return t('chive-type-number');
	if (type === 'text') return t('chive-type-text');
	if (type === 'date') return t('chive-type-date');
	return type;
}

/**
 * @returns {string} The currently active locale code (e.g. `'pt-BR'` or `'en'`).
 */
export function getLocale() {
	return banana.locale;
}

/**
 * Switch the active locale and apply it everywhere it shows. Side effects:
 *   1. Banana switches active locale.
 *   2. `<html lang>` is updated.
 *   3. The chosen locale is persisted to localStorage.
 *   4. Every static `[data-i18n]` node in the page is re-translated.
 *   5. A `'chive-locale-changed'` CustomEvent is dispatched on `window` so
 *      dynamic views can refresh their own content.
 *
 * No-op when `locale` is not in `SUPPORTED_LOCALES`.
 *
 * @param {string} locale
 */
export function setLocale(locale) {
	if (!LOCALES.includes(locale)) return;
	banana.setLocale(locale);
	document.documentElement.lang = locale;
	localStorage.setItem(LOCALE_KEY, locale);
	translateStaticPage();
	window.dispatchEvent(new CustomEvent('chive-locale-changed', { detail: { locale } }));
}

/**
 * Boot-time initialization. Reads the persisted locale (falling back to
 * `'pt-BR'`), syncs `<html lang>`, populates the language selector,
 * translates every static `[data-i18n]` node, wires the selector's
 * `change` listener, and reveals `document.body` (which is hidden until
 * translation completes to avoid a flash of untranslated keys).
 *
 * Call exactly once on startup.
 */
export function initializeI18n() {
	const savedLocale = localStorage.getItem(LOCALE_KEY);
	const locale = LOCALES.includes(savedLocale) ? savedLocale : 'pt-BR';
	banana.setLocale(locale);
	document.documentElement.lang = locale;

	const selectLang = document.getElementById('select-lang');
	if (selectLang) selectLang.value = locale;

	// Update language display button
	const langDisplay = document.getElementById('lang-display');
	if (langDisplay) {
		const option = selectLang?.querySelector(`option[value="${locale}"]`);
		langDisplay.textContent = LOCALE_LABELS[locale] || option?.textContent?.trim() || locale;
	}

	translateStaticPage();
	setupLanguageSelector();
	document.body.style.visibility = 'visible';
}

/**
 * @private
 */
function setupLanguageSelector() {
	const selectLang = document.getElementById('select-lang');
	const langDisplay = document.getElementById('lang-display');
	if (!selectLang) return;

	const getLabel = (loc) => LOCALE_LABELS[loc] || loc;

	selectLang.addEventListener('change', event => {
		setLocale(event.target.value);
	});

	window.addEventListener('chive-locale-changed', () => {
		const loc = getLocale();
		selectLang.value = loc;
		if (langDisplay) langDisplay.textContent = getLabel(loc);
	});
}

/**
 * Update every [data-i18n] element in the page.
 * Elements that also have [data-i18n-html] use innerHTML (safe: strings come
 * from our own translation files, never from user input).
 */
function translateStaticPage() {
	document.title = t('chive-page-title');

	document.querySelectorAll('[data-i18n]').forEach(el => {
		if (el.hasAttribute('data-i18n-html')) {
			el.innerHTML = t(el.dataset.i18n);
		} else {
			el.textContent = t(el.dataset.i18n);
		}
	});

	document.querySelectorAll('[data-i18n-title]').forEach(el => {
		const text = t(el.dataset.i18nTitle);
		el.title = text;
		if (el.hasAttribute('aria-label')) el.setAttribute('aria-label', text);
	});
}
