/**
 * Pie-chart slice color sequencing.
 *
 * Owns the single-base-color variation used when the user picks one base
 * color instead of per-slice overrides: 8% darker per index step, capped at
 * 8 steps, with the default pie base color as the parse fallback. Pure over
 * `colorUtils`; no DOM, no d3. Used by `renderers/svg.js`.
 */

import { CHART_COLORS } from '../../config/charts/definitions.js';
import { parseHexColor, toHex } from '../../utils/colorUtils.js';

/**
 * Produce a sequential variation of `baseHex` by darkening 8% per index
 * step, capped at 8 steps. Falls back to the default pie base color when
 * `baseHex` does not parse; returns `baseHex` unchanged when neither input
 * parses.
 *
 * @param {string} baseHex - Primary hex color.
 * @param {number} index - Position in the sequence (0 = base shade).
 * @returns {string} Hex color.
 */
export function buildSliceColor(baseHex, index) {
	const rgb = parseHexColor(baseHex) || parseHexColor(CHART_COLORS.pie);
	if (!rgb) return baseHex;
	const factor = 1 - (Math.min(index, 8) * 0.08);
	return `#${toHex(rgb.r * factor)}${toHex(rgb.g * factor)}${toHex(rgb.b * factor)}`;
}
