/**
 * Bar-chart data aggregation.
 *
 * Orders the shared category aggregation by the bar sort mode and applies
 * the Top-N trim. The returned `total` is summed AFTER the Top-N trim. Pure:
 * no DOM, no d3. Used by `renderers/svg.js`.
 */

import { aggregateCategories } from '../shared/categoryAggregation.js';
import { compareCategoryKeys } from '../shared/categoryOrder.js';

/**
 * @typedef {import('../shared/categoryAggregation.js').CategoryEntry} BarEntry
 */

// WHY: every count-based sort uses `|| compareCategoryKeys(a.key, b.key)` as a
// tiebreaker so categories with equal counts have a deterministic visual order.
// Without the secondary compare, sort stability varies by browser engine and
// the bar order can flicker between renders on identical data. The default
// `count-desc` is the order aggregateCategories already returns.
function sortCategories(entries, sort) {
	if (sort === 'count-asc') {
		return entries.sort((a, b) => a.value - b.value || compareCategoryKeys(a.key, b.key));
	}

	if (sort === 'label-asc') {
		return entries.sort((a, b) => compareCategoryKeys(a.key, b.key));
	}

	if (sort === 'label-desc') {
		return entries.sort((a, b) => compareCategoryKeys(a.key, b.key, -1));
	}

	return entries;
}

/**
 * Aggregate rows for the bar chart.
 *
 * @param {Array<Object<string, *>>} rows - Canonical source rows.
 * @param {string} categoryColumn - Categorical column name.
 * @param {{ measureMode: 'count'|'sum'|'mean', valueColumn: string|null, sort: string, topN: number, missingLabel: string }} params
 * @returns {{ ok: false, reason?: string } | { ok: true, entries: BarEntry[], total: number }} Fails like `aggregateCategories`.
 */
export function aggregateBarData(rows, categoryColumn, { measureMode, valueColumn, sort, topN, missingLabel }) {
	const aggregated = aggregateCategories(rows, categoryColumn, { measureMode, valueColumn, missingLabel });
	if (!aggregated.ok) return aggregated;

	let entries = sortCategories(aggregated.entries, sort);
	if (topN > 0) {
		entries = entries.slice(0, topN);
	}
	const total = entries.reduce((acc, entry) => acc + entry.value, 0);

	return { ok: true, entries, total };
}
