/**
 * The sectors a pie chart draws.
 *
 * Asks the shared category aggregation for the categories whose value is
 * above 0, since a sector needs an angle, cut to Top-N. `truncate` drops what
 * the cut leaves out; `other` folds it into the Other sector. Then it fills
 * each sector. Every rule that sets the Other sector apart lives here:
 * its key, its label, its lack of a category token, its fixed color, and its
 * place outside the base color's shades. The renderer draws these sectors and
 * the per-slice color grid shows their fills, so the two cannot disagree.
 * Pure: no DOM, no d3. Used by `renderers/svg.js` and
 * `controls/sectorValues.js`.
 */

import { PIE_CHART } from '../../config/charts/definitions/pie.js';
import { aggregateCategories } from '../shared/categoryAggregation.js';
import { buildSliceColor } from './color.js';

/**
 * @typedef {{ key: string, label: string, token: string|null, value: number, color: string, isOther: boolean }} PieSector
 */

/**
 * Key of the Other sector. Like the missing key, no category value produces
 * it by accident, so a real category spelled like the Other label keeps its
 * own pin and color identity.
 */
export const OTHER_SECTOR_KEY = '__chive_other__';

/**
 * The pie's sectors in drawn order: the categories of
 * {@link aggregateCategories} whose value is above 0, with Top-N applied
 * and the Other sector last. The Other sector takes its fixed color; a
 * category takes its custom slice color, else the base color's shade for its
 * place among the category sectors. A category with a custom color keeps its
 * place, so changing that color never shifts the other shades.
 *
 * Accepts normalized pie config only. The renderer and color controls each
 * normalize once before this call. Labels are separate presentation inputs.
 *
 * @param {Array<Object<string, *>>} rows - The rows the chart draws, already narrowed by the global filter.
 * @param {string} categoryColumn - Categorical column name.
 * @param {Object} options - Result of normalizePieOptions(config).
 * @param {{ other?: string, missing?: string }} [labels] - Localized sector labels; optional for color-only callers.
 * @returns {{ ok: false, reason?: string } | { ok: true, sectors: PieSector[], total: number }}
 *   Fails like `aggregateCategories`, including `'no-positive-value'` when no
 *   value is above 0. `total` sums the sectors drawn, the Other sector
 *   included, so a sector's value over it is its share of the circle.
 */
export function computePieSectors(rows, categoryColumn, options, labels = {}) {
	const { measureMode, valueColumn, topN, topNMode, color, customSliceColors } = options;
	const aggregated = aggregateCategories(rows, categoryColumn, {
		measureMode, valueColumn, missingLabel: labels.missing, positiveOnly: true, topN,
	});
	if (!aggregated.ok) return aggregated;

	const { entries: categories, omittedValueTotal } = aggregated;
	const otherValue = topNMode === 'other' ? omittedValueTotal : null;

	// WHY: category keys are cell text, so read only own keys. A category
	// named `constructor` would otherwise take Object.prototype's function as
	// its fill and draw black.
	const customColor = key => (Object.hasOwn(customSliceColors, key) ? customSliceColors[key] : null);
	const sectors = categories.map(({ key, label, token, value }, index) => ({
		key,
		label,
		token,
		value,
		color: customColor(key) || buildSliceColor(color, index, categories.length),
		isOther: false,
	}));
	if (otherValue !== null) {
		sectors.push({
			key: OTHER_SECTOR_KEY,
			label: labels.other,
			token: null,
			value: otherValue,
			color: PIE_CHART.otherSliceColor,
			isOther: true,
		});
	}

	return { ok: true, sectors, total: aggregated.retainedValueTotal + (otherValue ?? 0) };
}
