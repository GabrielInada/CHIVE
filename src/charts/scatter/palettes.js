/**
 * Scatter-plot qualitative color palettes.
 *
 * Owns the category-color palettes for scatter rendering. The arrays are
 * frozen so callers can reuse them without being able to mutate global
 * palette state.
 */

const SCATTER_PALETTES = Object.freeze({
	Pastel: Object.freeze(['#FFB3BA', '#FFCCCB', '#FFFFBA', '#BAE1BA', '#BAC7FF', '#E0BBE4', '#FFDFD3', '#DFF8EB']),
	Bold: Object.freeze(['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2']),
	'Colorblind-Safe': Object.freeze(['#0173B2', '#029E73', '#ECE133', '#CC78BC', '#CA9161', '#949494', '#ECE2F0', '#A6ACAF']),
});

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
