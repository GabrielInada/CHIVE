/**
 * Configuration for browser-local application settings.
 *
 * These are browser-local preferences owned by `settingsService.js`. They are
 * deliberately separate from `chive.ui` (removed by the project-persistence
 * clear operation) and from `chive-locale` (owned by `i18nService.js`).
 */

export const SETTINGS_STORAGE_KEY = 'chive.settings';

/** CustomEvent dispatched on `window` when a setting actually changes. */
export const SETTINGS_CHANGE_EVENT = 'chive-settings-changed';

/** Supported TIN color-rendering modes, in display order. */
export const TIN_COLOR_RENDERING_MODES = Object.freeze(['optimized', 'full-ramp']);

export const DEFAULT_TIN_COLOR_RENDERING = 'optimized';
