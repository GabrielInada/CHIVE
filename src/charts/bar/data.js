/**
 * Bar-chart data aggregation.
 *
 * Aggregates rows into bar entries by count, numeric sum, or mean, applying the
 * same `N/A` bucketing, sort, and Top-N trim as the renderer did inline. The
 * returned `total` is summed AFTER the Top-N trim. Pure: no DOM, no d3. Used by
 * `renderers/svg.js`.
 */

import { isNullish } from '../../utils/formatters.js';
import { compareStrings } from '../../utils/chartFilters.js';

// WHY: every count-based sort uses `|| compareStrings(a[0], b[0])` as a tiebreaker
// so categories with equal counts have a deterministic visual order. Without the
// secondary string compare, sort stability varies by browser engine and the bar
// order can flicker between renders on identical data.
function sortCategories(entries, sort) {
	if (sort === 'count-asc') {
		return entries.sort((a, b) => a[1] - b[1] || compareStrings(a[0], b[0]));
	}

	if (sort === 'label-asc') {
		return entries.sort((a, b) => compareStrings(a[0], b[0]));
	}

	if (sort === 'label-desc') {
		return entries.sort((a, b) => compareStrings(b[0], a[0]));
	}

	return entries.sort((a, b) => b[1] - a[1] || compareStrings(a[0], b[0]));
}

/**
 * Aggregate rows for the bar chart.
 *
 * @param {Array<Object<string, *>>} rows - Source rows.
 * @param {string} categoryColumn - Categorical column name.
 * @param {{ measureMode: 'count'|'sum'|'mean', valueColumn: string|null, sort: string, topN: number }} params
 * @returns {{ ok: false, reason?: string } | { ok: true, entries: Array<[string, number]>, total: number }}
 */
export function aggregateBarData(rows, categoryColumn, { measureMode, valueColumn, sort, topN }) {
	const hasValueColumn = (measureMode === 'count')
		? true
		: rows.some(row => Object.prototype.hasOwnProperty.call(row, valueColumn));

	const counter = new Map();
	const counterN = new Map();

	if (measureMode === 'count') {
		rows.forEach(row => {
			const rawValue = row[categoryColumn];
			const category = isNullish(rawValue) || rawValue === ''
				? 'N/A'
				: String(rawValue);
			counter.set(category, (counter.get(category) || 0) + 1);
		});
	} else {
		if (!valueColumn || !hasValueColumn) return { ok: false, reason: 'no-value-column' };
		rows.forEach(row => {
			const rawValue = row[categoryColumn];
			const category = isNullish(rawValue) || rawValue === ''
				? 'N/A'
				: String(rawValue);
			const value = Number(row[valueColumn]);
			if (!Number.isFinite(value)) return;
			counter.set(category, (counter.get(category) || 0) + value);
			counterN.set(category, (counterN.get(category) || 0) + 1);
		});

		if (measureMode === 'mean') {
			for (const [category, sum] of counter.entries()) {
				counter.set(category, sum / (counterN.get(category) || 1));
			}
		}
	}

	if ((measureMode === 'sum' || measureMode === 'mean') && counter.size === 0) {
		return { ok: false, reason: 'no-numeric' };
	}

	let entries = Array.from(counter.entries());
	entries = sortCategories(entries, sort);

	if (topN > 0) {
		entries = entries.slice(0, topN);
	}

	if (entries.length === 0) return { ok: false };
	const total = entries.reduce((acc, item) => acc + item[1], 0);

	return { ok: true, entries, total };
}
