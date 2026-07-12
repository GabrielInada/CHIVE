/**
 * CHIVE browser-local settings service.
 *
 * Sole owner of the `chive.settings` localStorage key. Settings here are
 * browser-local rendering/UX preferences: they never enter projects, imports,
 * exports, or panel snapshots. The project-persistence clear operation removes
 * `chive.ui` but not this key. Locale stays with `i18nService.js` under its own
 * `chive-locale` key.
 *
 * Reads normalize missing, malformed, non-object, or unknown values to the
 * defaults. Writes are best-effort: when localStorage is unavailable the
 * in-memory value still applies for the current page session. A real change
 * dispatches a `chive-settings-changed` CustomEvent on `window` with
 * `{ key, value }` in `detail`; setting the current value is a no-op.
 */

import {
	SETTINGS_STORAGE_KEY,
	SETTINGS_CHANGE_EVENT,
	TIN_COLOR_RENDERING_MODES,
	DEFAULT_TIN_COLOR_RENDERING,
} from '../config/settings.js';

/** @type {{ tinColorRendering: string } | null} */
let cachedSettings = null;

/** @private */
function normalizeTinColorRendering(value) {
	return TIN_COLOR_RENDERING_MODES.includes(value) ? value : DEFAULT_TIN_COLOR_RENDERING;
}

/**
 * Collapse an arbitrary parsed payload into the canonical settings shape.
 * Arrays are objects too, so they are rejected explicitly.
 *
 * @private
 * @param {unknown} raw
 * @returns {{ tinColorRendering: string }}
 */
function normalizeSettings(raw) {
	const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
	return {
		tinColorRendering: normalizeTinColorRendering(source.tinColorRendering),
	};
}

/**
 * The in-memory settings record, lazily hydrated from localStorage. Any read
 * or storage failure falls back to defaults without throwing.
 *
 * @private
 * @returns {{ tinColorRendering: string }}
 */
function loadSettings() {
	if (cachedSettings) return cachedSettings;
	let parsed = null;
	try {
		const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
		parsed = raw ? JSON.parse(raw) : null;
	} catch {
		parsed = null;
	}
	cachedSettings = normalizeSettings(parsed);
	return cachedSettings;
}

/**
 * @returns {{ tinColorRendering: string }} A copy of the current settings.
 */
export function getSettings() {
	return { ...loadSettings() };
}

/**
 * @returns {string} The active TIN color-rendering mode ('optimized' | 'full-ramp').
 */
export function getTinColorRendering() {
	return loadSettings().tinColorRendering;
}

/**
 * Set the TIN color-rendering mode. Unknown values normalize to the default.
 * No-op when the normalized value equals the current one; otherwise the value
 * is stored (best-effort) and one change event is dispatched.
 *
 * @param {string} mode
 */
export function setTinColorRendering(mode) {
	const value = normalizeTinColorRendering(mode);
	const settings = loadSettings();
	if (settings.tinColorRendering === value) return;
	settings.tinColorRendering = value;
	try {
		localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
	} catch {
		// Best-effort persistence: the in-memory value still applies this session.
	}
	window.dispatchEvent(new CustomEvent(SETTINGS_CHANGE_EVENT, {
		detail: { key: 'tinColorRendering', value },
	}));
}
