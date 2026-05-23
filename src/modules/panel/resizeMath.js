/**
 * CHIVE panel resize math.
 *
 * Stateless math helpers used by {@link panelResize} to clamp proportions
 * and compute layout-aware minimum heights. Also re-exports a hex-color
 * normalizer used by both the renderer and the exporter.
 */

import { isValidHexColor } from '../../utils/colorUtils.js';

/**
 * Clamp `value` to `[min, max]` and coerce non-finite inputs to `min`.
 * Duplicate of {@link clampPercentage} in `blockStateHelpers.js` —
 * intentionally kept separate so panel-resize math has no dependency
 * back on the state-helpers module.
 *
 * @param {*} value
 * @param {number} [min=20]
 * @param {number} [max=80]
 * @returns {number}
 */
export function clampPercent(value, min = 20, max = 80) {
	const n = Number(value);
	if (!Number.isFinite(n)) return min;
	return Math.max(min, Math.min(max, n));
}

/**
 * Normalize a possibly-invalid hex color to a known-good value. Trims
 * whitespace and validates via {@link isValidHexColor}; returns the
 * fallback when the input is anything else.
 *
 * @param {*} color
 * @param {string} [fallback='#5d645d']
 * @returns {string}
 */
export function normalizeHexColor(color, fallback = '#5d645d') {
	const value = String(color || '').trim();
	return isValidHexColor(value) ? value : fallback;
}

/**
 * Compute a layout-aware minimum height in pixels. For templates with a
 * horizontal split (`layout-1x2`, `layout-hero2`), a small split percentage
 * makes one row tiny — this function derives the height that keeps the
 * smaller row at least `SLOT_MIN_HEIGHT` tall. Result is clamped to
 * `[220, 620]`.
 *
 * The dynamic ceiling exists because rendering can hit the upper bound
 * during automated resizing and we don't want auto-resize to push blocks
 * arbitrarily large.
 *
 * @param {string} templateId
 * @param {{ split?: number, splitRight?: number, splitMain?: number, a?: number, b?: number, c?: number }} [proportions]
 * @returns {number} Pixel height.
 */
export function computeDynamicMinHeight(templateId, proportions) {
	const BASE_MIN_HEIGHT = 220;
	const MAX_MIN_HEIGHT = 620;
	const SLOT_MIN_HEIGHT = 96;
	const ROW_GAP = 10;

	let dynamicMinHeight = BASE_MIN_HEIGHT;

	if (templateId === 'layout-1x2') {
		const split = clampPercent(proportions?.split ?? 50, 20, 80) / 100;
		const smallestRow = Math.min(split, 1 - split);
		dynamicMinHeight = ROW_GAP + SLOT_MIN_HEIGHT / Math.max(smallestRow, 0.01);
	} else if (templateId === 'layout-hero2') {
		const splitRight = clampPercent(proportions?.splitRight ?? 50, 20, 80) / 100;
		const smallestRow = Math.min(splitRight, 1 - splitRight);
		dynamicMinHeight = ROW_GAP + SLOT_MIN_HEIGHT / Math.max(smallestRow, 0.01);
	}

	return Math.max(BASE_MIN_HEIGHT, Math.min(dynamicMinHeight, MAX_MIN_HEIGHT));
}
