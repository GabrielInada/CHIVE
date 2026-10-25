/**
 * Pie-chart slice color sequencing.
 *
 * Owns the single-base-color variation used when the user picks one base
 * color instead of per-slice overrides: 8% darker per index step, capped at
 * 8 steps, with the default pie base color as the parse fallback. Also owns
 * the fill precedence of a drawn sector, so the chart and the per-slice color
 * grid agree. Pure over `colorUtils`; no DOM, no d3. Used by
 * `renderers/svg.js` and `controls/sectorValues.js`.
 */

import { CHART_COLORS } from '../../config/charts/definitions.js';
import { PIE_CHART } from '../../config/charts/definitions/pie.js';
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

/**
 * Fill of every drawn sector: the synthetic Other sector keeps its fixed
 * color, a custom slice color wins next, and any other sector takes the base
 * color's shade for its position in the drawn order.
 *
 * @param {Array<{ key: string, isOther?: boolean }>} entries - Drawn sectors in order, after Top-N.
 * @param {{ color: string, customSliceColors?: Object<string, string> | null }} colors
 * @returns {Map<string, string>} Hex color by sector key.
 */
export function resolveSliceColors(entries, { color, customSliceColors }) {
	const custom = customSliceColors || {};
	return new Map(entries.map((entry, index) => [
		entry.key,
		entry.isOther ? PIE_CHART.otherSliceColor : (custom[entry.key] || buildSliceColor(color, index)),
	]));
}
