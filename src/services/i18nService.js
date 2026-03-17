import Banana from 'banana-i18n';
import ptBR from '../i18n/pt-BR.json';
import en from '../i18n/en.json';

const LOCALES = ['pt-BR', 'en'];
const CHAVE_LOCALE = 'chive-locale';

const banana = new Banana('pt-BR');
banana.load(ptBR, 'pt-BR');
banana.load(en, 'en');

/**
 * Translate a message key with optional positional parameters ($1, $2, …).
 * Supports banana-i18n markup: {{PLURAL:$1|one|other}}, etc.
 */
export function t(chave, ...params) {
	return banana.i18n(chave, ...params);
}

/** Returns the currently active locale code, e.g. 'pt-BR' or 'en'. */
export function obterLocale() {
	return banana.locale;
}

/**
 * Switch the active locale, persist it, re-translate static [data-i18n] nodes,
 * and fire 'chive-locale-changed' so the app can re-render dynamic content.
 */
export function definirLocale(locale) {
	if (!LOCALES.includes(locale)) return;
	banana.setLocale(locale);
	document.documentElement.lang = locale;
	localStorage.setItem(CHAVE_LOCALE, locale);
	traduirPaginaEstatica();
	window.dispatchEvent(new CustomEvent('chive-locale-changed', { detail: { locale } }));
}

/**
 * Call once on startup. Reads the persisted locale (defaults to 'pt-BR'),
 * syncs <html lang>, updates the selector value, and translates static nodes.
 */
export function inicializarI18n() {
	const salvo = localStorage.getItem(CHAVE_LOCALE);
	const locale = LOCALES.includes(salvo) ? salvo : 'pt-BR';
	banana.setLocale(locale);
	document.documentElement.lang = locale;

	const selectLang = document.getElementById('select-lang');
	if (selectLang) selectLang.value = locale;

	traduirPaginaEstatica();
}

/**
 * Update every [data-i18n] element in the page.
 * Elements that also have [data-i18n-html] use innerHTML (safe: strings come
 * from our own translation files, never from user input).
 */
function traduirPaginaEstatica() {
	document.title = t('chive-page-title');

	document.querySelectorAll('[data-i18n]').forEach(el => {
		if (el.hasAttribute('data-i18n-html')) {
			el.innerHTML = t(el.dataset.i18n);
		} else {
			el.textContent = t(el.dataset.i18n);
		}
	});

	document.querySelectorAll('[data-i18n-title]').forEach(el => {
		const texto = t(el.dataset.i18nTitle);
		el.title = texto;
		if (el.hasAttribute('aria-label')) el.setAttribute('aria-label', texto);
	});
}
