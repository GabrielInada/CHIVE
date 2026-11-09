/**
 * The categories the bar, pie, treemap and bubble charts draw.
 *
 * Groups canonical rows by category key, so the missing bucket never merges
 * with text that reads "N/A", measures each category, and applies the rules
 * that decide which categories a chart draws: pie, treemap and bubble leave
 * out values at or below 0, bar orders them by its sort, and a Top-N limit
 * keeps the first N. Each chart draws the result its own way; pie folds what
 * the cut leaves out into its Other sector. Pure: no DOM, no d3.
 */

import { categoryKey, describeCategory } from '../../domain/datasets/cellValues.js';
import { compareCategoryKeys } from './categoryOrder.js';

/**
 * @typedef {{ key: string, label: string, token: string, value: number, firstRow: Object<string, *> }} CategoryEntry
 */

// The orders bar offers, by sort mode. Value orders compare the selected
// measure. Ties fall back to the category key, missing bucket last.
const ORDERS = Object.freeze({
	'value-desc': (a, b) => b.value - a.value || compareCategoryKeys(a.key, b.key),
	'value-asc': (a, b) => a.value - b.value || compareCategoryKeys(a.key, b.key),
	'label-asc': (a, b) => compareCategoryKeys(a.key, b.key),
	'label-desc': (a, b) => compareCategoryKeys(a.key, b.key, -1),
});

/**
 * Group rows into categories, measure each one, and keep the categories a
 * chart draws, in its order.
 *
 * Sum and mean read the value column and skip a row whose cell is not a
 * number, so a missing value adds nothing and stays out of a mean's
 * denominator. Any other measure counts rows. With `positiveOnly`, values at
 * or below 0 are left out, since a sector, tile or bubble needs an area.
 * `sort` takes one of bar's sort modes; any other value keeps the largest
 * first. A `topN` above 0 then keeps the first N.
 *
 * @param {Array<Object<string, *>>} rows - Canonical rows.
 * @param {string} categoryColumn - Column whose category keys group the rows.
 * @param {{ measureMode: string, valueColumn?: string|null, missingLabel?: string, positiveOnly?: boolean, sort?: string, topN?: number }} options - `missingLabel` is the localized label of the missing bucket.
 * @returns {{ ok: false, reason?: 'no-value-column'|'no-numeric'|'no-positive-value' } | { ok: true, entries: CategoryEntry[], rest: number|null, total: number }}
 *   On success, at least one category, by default largest value first with
 *   ties by category key and the missing bucket last. `firstRow` is the first
 *   row counted toward the category. `rest` sums the values the Top-N cut
 *   leaves out, or is null when it leaves none out; `total` sums the values
 *   kept. Sum and mean fail with `'no-value-column'` without a value column
 *   or when no row has it, and with `'no-numeric'` when it holds no number in
 *   these rows. Count fails with no reason when there are no rows. With
 *   `positiveOnly`, the call fails with `'no-positive-value'` when no value
 *   is above 0.
 */
export function aggregateCategories(rows, categoryColumn, { measureMode, valueColumn, missingLabel, positiveOnly = false, sort, topN = 0 }) {
	const readsValues = measureMode === 'sum' || measureMode === 'mean';
	if (readsValues && (!valueColumn || !rows.some(row => Object.hasOwn(row, valueColumn)))) {
		return { ok: false, reason: 'no-value-column' };
	}

	const groups = new Map();
	for (const row of rows) {
		const value = readsValues ? row[valueColumn] : 1;
		if (!Number.isFinite(value)) continue;
		const key = categoryKey(row[categoryColumn]);
		let group = groups.get(key);
		if (!group) {
			group = { sum: 0, n: 0, firstRow: row };
			groups.set(key, group);
		}
		group.sum += value;
		group.n += 1;
	}
	if (groups.size === 0) return readsValues ? { ok: false, reason: 'no-numeric' } : { ok: false };

	let entries = Array.from(groups, ([key, { sum, n, firstRow }]) => ({
		key,
		...describeCategory(key, { missingLabel }),
		value: measureMode === 'mean' ? sum / n : sum,
		firstRow,
	}));
	if (positiveOnly) {
		entries = entries.filter(entry => entry.value > 0);
		if (entries.length === 0) return { ok: false, reason: 'no-positive-value' };
	}
	entries.sort(Object.hasOwn(ORDERS, sort) ? ORDERS[sort] : ORDERS['value-desc']);
	const cut = topN > 0 ? entries.splice(topN) : [];
	return { ok: true, entries, rest: cut.length > 0 ? sumValues(cut) : null, total: sumValues(entries) };
}

function sumValues(entries) {
	return entries.reduce((total, entry) => total + entry.value, 0);
}
