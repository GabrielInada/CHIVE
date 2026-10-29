/**
 * Treemap data aggregation.
 *
 * Keeps the categories of the shared category aggregation whose value is
 * positive, since a tile needs an area, and applies the Top-N trim. The
 * returned `total` is summed AFTER the Top-N trim, so percentages are relative
 * to the rendered cells, not the original rows. Pure: no DOM, no d3. Used by
 * `renderers/svg.js`.
 */

import { aggregateCategories } from '../shared/categoryAggregation.js';

/**
 * @typedef {import('../shared/categoryAggregation.js').CategoryEntry} TreemapEntry
 */

/**
 * Aggregate rows for the treemap.
 *
 * @param {Array<Object<string, *>>} rows - Canonical source rows.
 * @param {string} categoryColumn - Categorical column name.
 * @param {{ measureMode: 'count'|'sum', valueColumn: string|null, topN: number, missingLabel: string }} params
 * @returns {{ ok: false, reason?: string } | { ok: true, entries: TreemapEntry[], total: number }} Fails like `aggregateCategories`, and with `'no-positive-value'` when no value is positive.
 */
export function aggregateTreemapData(rows, categoryColumn, { measureMode, valueColumn, topN, missingLabel }) {
	const aggregated = aggregateCategories(rows, categoryColumn, { measureMode, valueColumn, missingLabel });
	if (!aggregated.ok) return aggregated;

	let entries = aggregated.entries.filter(entry => entry.value > 0);
	if (topN > 0) entries = entries.slice(0, topN);
	if (entries.length === 0) return { ok: false, reason: 'no-positive-value' };

	const total = entries.reduce((acc, entry) => acc + entry.value, 0);

	return { ok: true, entries, total };
}
