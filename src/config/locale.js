/**
 * Configuration for internationalization (i18n) and localization.
 */

export const SUPPORTED_LOCALES = ['pt-BR', 'en'];
export const DEFAULT_LOCALE = 'pt-BR';
export const LOCALE_STORAGE_KEY = 'chive-locale';

/**
 * Native-language display names for the locale selector. Endonyms are shown
 * as-is in every locale, so they are config data rather than i18n messages.
 */
export const LOCALE_LABELS = Object.freeze({
	'pt-BR': 'Português',
	'en': 'English',
});
