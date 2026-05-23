/**
 * CHIVE color utilities. Used by visualization modules, chart controls,
 * and {@link panelStateMutations} (which uses {@link isValidHexColor} to
 * guard border-color writes).
 *
 * @typedef {{ r: number, g: number, b: number }} RgbColor
 */

/**
 * Parse a 6-digit hex color into RGB components. Tolerant of leading `#`,
 * whitespace, and case; returns `{ r: 0, g: 0, b: 0 }` on any parse failure
 * so downstream math does not throw.
 *
 * @param {string | null | undefined} hex
 * @returns {RgbColor}
 */
export function hexToRgb(hex) {
	const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || '').trim());
	if (!match) return { r: 0, g: 0, b: 0 };
	return {
		r: parseInt(match[1], 16),
		g: parseInt(match[2], 16),
		b: parseInt(match[3], 16),
	};
}

/**
 * Convert a 0–255 channel value to a 2-char hex byte. Clamps out-of-range
 * inputs so callers can hand off raw arithmetic results without rounding
 * concerns.
 *
 * @param {number} value
 * @returns {string} Lowercase 2-char hex (e.g. `'ff'`).
 */
export function toHex(value) {
	return Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0');
}

/**
 * Compose RGB channels into a `#RRGGBB` hex string. Output is uppercased
 * for visual consistency with hand-authored CSS values.
 *
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {string}
 */
export function rgbToHex(r, g, b) {
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Linear-interpolate between two hex colors. `t` is clamped to `[0, 1]`.
 * Used by gradient color modes across chart renderers.
 *
 * @param {string} minColor - Hex color at `t = 0`.
 * @param {string} maxColor - Hex color at `t = 1`.
 * @param {number} t - Interpolation factor; clamped to `[0, 1]`.
 * @returns {string} Interpolated hex color.
 */
export function interpolateColor(minColor, maxColor, t) {
	const clamped = Math.max(0, Math.min(1, t));
	const start = hexToRgb(minColor);
	const end = hexToRgb(maxColor);
	return rgbToHex(
		start.r + ((end.r - start.r) * clamped),
		start.g + ((end.g - start.g) * clamped),
		start.b + ((end.b - start.b) * clamped),
	);
}

/**
 * Validate that a string is a strict `#RRGGBB` hex color. Used as a guard
 * before writing user-supplied colors to state (block borders, custom
 * slice colors, etc.).
 *
 * @param {*} value
 * @returns {boolean}
 */
export function isValidHexColor(value) {
	return /^#[0-9a-fA-F]{6}$/.test(value);
}

/**
 * Stricter counterpart to {@link hexToRgb}: returns `null` (not zeroed RGB)
 * when the input is not a valid hex color. Callers that need to branch on
 * validity should prefer this.
 *
 * @param {string | null | undefined} color
 * @returns {RgbColor | null}
 */
export function parseHexColor(color) {
	const normalized = String(color || '').trim();
	if (!isValidHexColor(normalized)) return null;
	return {
		r: parseInt(normalized.slice(1, 3), 16),
		g: parseInt(normalized.slice(3, 5), 16),
		b: parseInt(normalized.slice(5, 7), 16),
	};
}

/**
 * Produce a sequential variation of `baseHex` by darkening 8% per index
 * step, capped at 8 steps. Used by pie/treemap to vary slice colors when
 * the user picks a single base color rather than a palette.
 *
 * @param {string} baseHex - Primary hex; falls back to `fallbackHex` if invalid.
 * @param {number} index - Position in the sequence (0 = base shade).
 * @param {string} fallbackHex
 * @returns {string} Hex color. Returns `baseHex` unchanged when neither input parses.
 */
export function buildSliceColor(baseHex, index, fallbackHex) {
	const rgb = parseHexColor(baseHex) || parseHexColor(fallbackHex);
	if (!rgb) return baseHex;
	const factor = 1 - (Math.min(index, 8) * 0.08);
	const r = rgb.r * factor;
	const g = rgb.g * factor;
	const b = rgb.b * factor;
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Build a `Map<item, rank>` keyed by ascending numeric value, with stable
 * ties broken by original index. Items whose accessor returns a non-finite
 * value are skipped (they will not appear in the map). Used by ranked
 * color modes to assign a quantile slot per item.
 *
 * @template T
 * @param {T[]} items
 * @param {(item: T) => number} valueAccessor
 * @returns {Map<T, number>} Zero-based rank by ascending value.
 */
export function buildRankMap(items, valueAccessor) {
	const sorted = items
		.map((item, idx) => ({ item, idx, v: Number(valueAccessor(item)) }))
		.filter(({ v }) => Number.isFinite(v))
		.sort((a, b) => a.v - b.v || a.idx - b.idx);
	const map = new Map();
	sorted.forEach((entry, rank) => map.set(entry.item, rank));
	return map;
}
