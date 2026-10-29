/**
 * The sectors a pie chart draws.
 *
 * Keeps the categories of the shared category aggregation whose value is
 * above 0, since a sector needs an angle, applies Top-N handling to them
 * (`truncate` drops the tail; `other` folds it into the Other sector) and
 * fills each sector. Every rule that sets the Other sector apart lives here:
 * its key, its label, its lack of a category token, its fixed color, and its
 * place outside the base color's shades. The renderer draws these sectors and
 * the per-slice color grid shows their fills, so the two cannot disagree.
 * Pure: no DOM, no d3. Used by `renderers/svg.js` and
 * `controls/sectorValues.js`.
 *
 * @typedef {import('../shared/categoryAggregation.js').CategoryEntry} CategoryEntry
 */

import { PIE_CHART } from '../../config/charts/definitions/pie.js';
import { aggregateCategories } from '../shared/categoryAggregation.js';
import { buildSliceColor } from './color.js';
import { normalizePieOptions } from './options.js';

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
 * Aggregate rows into the pie's categories, whatever the sign of their value,
 * before Top-N. A measure other than sum counts rows, because the color
 * controls pass the saved config without normalizing it.
 *
 * @param {Array<Object<string, *>>} rows - Canonical source rows.
 * @param {string} categoryColumn - Categorical column name.
 * @param {{ measureMode: 'count'|'sum', valueColumn: string|null, missingLabel?: string }} params
 * @returns {{ ok: false, reason?: string } | { ok: true, entries: CategoryEntry[] }} Fails like `aggregateCategories`.
 */
export function aggregatePieCategories(rows, categoryColumn, { measureMode, valueColumn, missingLabel }) {
	return aggregateCategories(rows, categoryColumn, {
		measureMode: measureMode === 'sum' ? 'sum' : 'count',
		valueColumn,
		missingLabel,
	});
}

/**
 * The pie's sectors in drawn order: the categories of
 * {@link aggregatePieCategories} whose value is above 0, with Top-N applied
 * and the Other sector last. The Other sector takes its fixed color; a
 * category takes its custom slice color, else the base color's shade for its
 * place among the category sectors. A category with a custom color keeps its
 * place, so changing that color never shifts the other shades.
 *
 * Reads `options` through `normalizePieOptions`, so the pie config block and
 * the renderer's options bag give the same sectors. `labels.other` labels the
 * Other sector and `labels.missing` the missing bucket.
 *
 * @param {Array<Object<string, *>>} rows - The rows the chart draws, already narrowed by the global filter.
 * @param {string} categoryColumn - Categorical column name.
 * @param {Object} options - The pie config block or the renderer's options bag.
 * @returns {{ ok: false, reason?: string } | { ok: true, sectors: PieSector[], total: number }}
 *   Fails like `aggregateCategories`, and with `'no-positive-value'` when no
 *   value is above 0. `total` is summed after Top-N, so a sector's value over
 *   it is its share of the circle.
 */
export function computePieSectors(rows, categoryColumn, options) {
	const { measureMode, valueColumn, topN, topNMode, color, customSliceColors, labels } = normalizePieOptions(options);
	const aggregated = aggregatePieCategories(rows, categoryColumn, { measureMode, valueColumn, missingLabel: labels.missing });
	if (!aggregated.ok) return aggregated;

	let categories = aggregated.entries.filter(entry => entry.value > 0);
	if (categories.length === 0) return { ok: false, reason: 'no-positive-value' };
	let otherValue = null;
	if (topN > 0 && categories.length > topN) {
		if (topNMode === 'other') otherValue = categories.slice(topN).reduce((sum, entry) => sum + entry.value, 0);
		categories = categories.slice(0, topN);
	}

	const sectors = categories.map(({ key, label, token, value }, index) => ({
		key,
		label,
		token,
		value,
		color: customSliceColors[key] || buildSliceColor(color, index, categories.length),
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

	const total = sectors.reduce((sum, sector) => sum + sector.value, 0);
	return { ok: true, sectors, total };
}
