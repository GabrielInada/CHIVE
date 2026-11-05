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
 * Get the frozen palette array for a scheme. The scheme is read as given:
 * chart config canonicalization checks it against the chart's definition.
 *
 * @param {string} colorScheme - One of the palette names.
 * @returns {ReadonlyArray<string>}
 */
export function getScatterPalette(colorScheme) {
	return SCATTER_PALETTES[colorScheme];
}
