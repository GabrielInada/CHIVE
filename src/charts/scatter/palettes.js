/**
 * Scatter-plot qualitative color palettes.
 *
 * Owns the category-color palettes for scatter rendering: frozen copies of
 * the shared chart palettes, so the scatter offers every palette its preset
 * buttons do and callers can reuse the arrays without being able to mutate
 * global palette state.
 */

import { CHART_COLOR_PALETTES } from '../../config/charts/shared.js';

const SCATTER_PALETTES = Object.freeze(Object.fromEntries(
	Object.entries(CHART_COLOR_PALETTES).map(([name, colors]) => [name, Object.freeze([...colors])]),
));

/**
 * Resolve a palette name to a known scheme, falling back to `'Bold'` for an
 * unknown or missing name.
 *
 * @param {string} colorScheme
 * @returns {string} A valid scatter palette key.
 */
export function resolveScatterColorScheme(colorScheme) {
	return SCATTER_PALETTES[colorScheme] ? colorScheme : 'Bold';
}

/**
 * Get the frozen palette array for a scheme (Bold fallback).
 *
 * @param {string} colorScheme
 * @returns {ReadonlyArray<string>}
 */
export function getScatterPalette(colorScheme) {
	return SCATTER_PALETTES[resolveScatterColorScheme(colorScheme)];
}
