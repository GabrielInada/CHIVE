import Banana from 'banana-i18n';
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
 * Translate a message key with optional positional parameters ($1, $2, …).
 * Supports banana-i18n markup: {{PLURAL:$1|one|other}}, etc.
 */
export function t(key, ...params) {
	return banana.i18n(key, ...params);
}

/** Returns the currently active locale code, e.g. 'pt-BR' or 'en'. */
export function getLocale() {
	return banana.locale;
}

/**
 * Switch the active locale, persist it, re-translate static [data-i18n] nodes,
 * and fire 'chive-locale-changed' so the app can re-render dynamic content.
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
 * Call once on startup. Reads the persisted locale (defaults to 'pt-BR'),
 * syncs <html lang>, updates the selector value, and translates static nodes.
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
