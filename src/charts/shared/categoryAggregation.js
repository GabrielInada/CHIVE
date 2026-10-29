/**
 * Category aggregation shared by the bar, pie, treemap and bubble charts.
 *
 * Groups canonical rows by category key, so the missing bucket never merges
 * with text that reads "N/A", measures each category, and orders the result.
 * Each chart applies its own step and its Top-N cut to the ordered list.
 * Pure: no DOM, no d3.
 */

import { categoryKey, describeCategory } from '../../domain/datasets/cellValues.js';
import { compareCategoryKeys } from './categoryOrder.js';

/**
 * @typedef {{ key: string, label: string, token: string, value: number, firstRow: Object<string, *> }} CategoryEntry
 */

/**
 * Group rows into categories and measure each one.
 *
 * Sum and mean read the value column and skip a row whose cell is not a
 * number, so a missing value adds nothing and stays out of a mean's
 * denominator. Any other measure counts rows.
 *
 * @param {Array<Object<string, *>>} rows - Canonical rows.
 * @param {string} categoryColumn - Column whose category keys group the rows.
 * @param {{ measureMode: string, valueColumn?: string|null, missingLabel?: string }} measure - `missingLabel` is the localized label of the missing bucket.
 * @returns {{ ok: false, reason?: 'no-value-column'|'no-numeric' } | { ok: true, entries: CategoryEntry[] }}
 *   On success, at least one category: largest value first, ties by category
 *   key with the missing bucket last. `firstRow` is the first row counted
 *   toward the category. Sum and mean fail with `'no-value-column'` without a
 *   value column or when no row has it, and with `'no-numeric'` when it holds
 *   no number in these rows. Count fails with no reason when there are no rows.
 */
export function aggregateCategories(rows, categoryColumn, { measureMode, valueColumn, missingLabel }) {
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

	const entries = Array.from(groups, ([key, { sum, n, firstRow }]) => ({
		key,
		...describeCategory(key, { missingLabel }),
		value: measureMode === 'mean' ? sum / n : sum,
		firstRow,
	}));
	return { ok: true, entries: entries.sort((a, b) => b.value - a.value || compareCategoryKeys(a.key, b.key)) };
}
