/**
 * Category ordering shared by the chart packages.
 *
 * Charts identify categories by category key (see `domain/datasets/cellValues.js`).
 * Label sorts keep the missing bucket last in both directions, so reversing
 * an alphabetical sort never promotes it to the front.
 */

import { MISSING_KEY } from '../../domain/datasets/cellValues.js';

/**
 * String comparator used as a sort tiebreaker across chart renderers.
 * Coerces inputs to `String` so undefined/null are ordered deterministically
 * instead of throwing from `localeCompare`.
 *
 * @param {*} a
 * @param {*} b
 * @returns {number} Negative if `a < b`, positive if `a > b`, `0` if equal.
 */
export function compareStrings(a, b) {
	return String(a).localeCompare(String(b));
}

/**
 * Comparator over category keys: the missing bucket sorts after every other
 * key whatever the direction; other keys compare as strings.
 *
 * @param {string} a - Category key.
 * @param {string} b - Category key.
 * @param {1|-1} [direction=1] - `-1` reverses the order of non-missing keys.
 * @returns {number}
 */
export function compareCategoryKeys(a, b, direction = 1) {
	const aMissing = a === MISSING_KEY;
	const bMissing = b === MISSING_KEY;
	if (aMissing || bMissing) {
		if (aMissing === bMissing) return 0;
		return aMissing ? 1 : -1;
	}
	return direction * compareStrings(a, b);
}
