/**
 * Pie-chart slice color sequencing.
 *
 * Owns the single-base-color variation used when the user picks one base
 * color instead of per-slice overrides: 8% darker per index step, down to
 * 64% darker at the 9th slice. A pie with more slices spreads that range over
 * all of them, alternating lighter and darker shades. The default pie base
 * color is the parse fallback. Pure over `colorUtils`; no DOM, no d3. Used by
 * `data.js`, which decides each sector's fill.
 */

import { CHART_COLORS } from '../../config/charts/definitions.js';
import { parseHexColor, toHex } from '../../utils/colorUtils.js';

const SHADE_STEP = 0.08;
const STEPPED_SLICES = 9;
const MAX_DARKENING = SHADE_STEP * (STEPPED_SLICES - 1);

/**
 * How much darker than the base color the slice at `index` is, from 0 to
 * `MAX_DARKENING`. Past 9 slices the 8% steps would run past the darkest
 * shade, so each slice gets its own shade in the same range instead. Those
 * shades sit too close together to tell neighbors apart in order, so even
 * slices take the lighter half in order and odd slices the darker half. Each
 * slice then stays about half the range from the slices beside it.
 *
 * @param {number} index - Position in the sequence (0 = base shade).
 * @param {number} count - Number of slices that take a shade.
 * @returns {number}
 */
function sliceDarkening(index, count) {
	if (count <= STEPPED_SLICES) return Math.min(index, STEPPED_SLICES - 1) * SHADE_STEP;
	const lighterHalf = Math.ceil(count / 2);
	const shade = index % 2 === 0 ? index / 2 : lighterHalf + ((index - 1) / 2);
	return (shade / (count - 1)) * MAX_DARKENING;
}

/**
 * Produce the shade of `baseHex` for the slice at `index`: 8% darker per
 * index step when `count` is 9 or fewer, else the alternating spread
 * described on `sliceDarkening`. Falls back to the default pie base color
 * when `baseHex` does not parse; returns `baseHex` unchanged when neither
 * input parses.
 *
 * @param {string} baseHex - Primary hex color.
 * @param {number} index - Position in the sequence (0 = base shade).
 * @param {number} [count=9] - Number of slices that take a shade. The default keeps the 8% steps, capped at the 9th shade.
 * @returns {string} Hex color.
 */
export function buildSliceColor(baseHex, index, count = STEPPED_SLICES) {
	const rgb = parseHexColor(baseHex) || parseHexColor(CHART_COLORS.pie);
	if (!rgb) return baseHex;
	const factor = 1 - sliceDarkening(index, count);
	return `#${toHex(rgb.r * factor)}${toHex(rgb.g * factor)}${toHex(rgb.b * factor)}`;
}
