/**
 * CHIVE i18n service.
 *
 * Loads only the active catalog during startup. Additional catalogs are
 * fetched on demand when the user changes language.
 */

import Banana from '../../vendor/banana-i18n/banana-i18n.js';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, LOCALE_STORAGE_KEY } from '../config/locale.js';
import { fail, ok } from '../utils/result.js';

const catalogLoaders = Object.freeze({
	'pt-BR': () => import('../i18n/pt-BR.json', { with: { type: 'json' } }),
	'en': () => import('../i18n/en.json', { with: { type: 'json' } }),
});

const catalogPromises = new Map();
const loadedCatalogs = new Set();
const banana = new Banana(DEFAULT_LOCALE);
let latestLocaleRequest = 0;

/**
 * @param {string} locale
 * @returns {Promise<Object>}
 */
function loadCatalog(locale) {
	if (!catalogPromises.has(locale)) {
		const promise = catalogLoaders[locale]()
			.then(module => module.default)
			.catch(error => {
				catalogPromises.delete(locale);
				throw error;
			});
		catalogPromises.set(locale, promise);
	}
	return catalogPromises.get(locale);
}

/**
 * @param {string} locale
 * @param {Object} messages
 */
function activateCatalog(locale, messages) {
	if (!loadedCatalogs.has(locale)) {
		banana.load(messages, locale);
		loadedCatalogs.add(locale);
	}
	banana.setLocale(locale);
	document.documentElement.lang = locale;
	translateStaticPage();
}

/**
 * @param {string} key
 * @param {...*} params
 * @returns {string}
 */
export function t(key, ...params) {
	return banana.i18n(key, ...params);
}

/**
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
 * @returns {string}
 */
export function getLocale() {
	return banana.locale;
}

/**
 * Load, persist, and activate a locale. A newer request wins if callers race.
 *
 * @param {string} locale
 * @returns {Promise<import('../types.js').Result>}
 */
export async function setLocale(locale) {
	if (!SUPPORTED_LOCALES.includes(locale)) return fail('unsupported-locale');
	const requestId = ++latestLocaleRequest;

	let messages;
	try {
		messages = await loadCatalog(locale);
	} catch {
		return fail('catalog-unavailable');
	}
	if (requestId !== latestLocaleRequest) return fail('superseded');

	try {
		localStorage.setItem(LOCALE_STORAGE_KEY, locale);
	} catch {
		return fail('storage-unavailable');
	}
	if (requestId !== latestLocaleRequest) return fail('superseded');

	activateCatalog(locale, messages);
	window.dispatchEvent(new CustomEvent('chive-locale-changed', { detail: { locale } }));
	return ok({ locale });
}

/**
 * Load the saved locale, falling back to pt-BR when storage is inaccessible or
 * contains an unsupported value.
 *
 * @returns {Promise<void>}
 */
export async function initializeI18n() {
	const requestId = ++latestLocaleRequest;
	let savedLocale = null;
	try {
		savedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
	} catch {
		// The default below keeps private/blocked storage from breaking startup.
	}
	const locale = SUPPORTED_LOCALES.includes(savedLocale) ? savedLocale : DEFAULT_LOCALE;
	const messages = await loadCatalog(locale);
	if (requestId !== latestLocaleRequest) return;
	activateCatalog(locale, messages);
}

/**
 * Update static translated content and translated attributes.
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

	document.querySelectorAll('[data-i18n-close-label]').forEach(el => {
		el.dataset.closeLabel = t(el.dataset.i18nCloseLabel);
	});
}
