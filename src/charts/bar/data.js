/**
 * Bar-chart data aggregation.
 *
 * Aggregates canonical rows into bar entries by count, numeric sum, or mean,
 * grouped by category key so the missing bucket never merges with text that
 * reads "N/A". Applies sort and Top-N trim. The returned `total` is summed
 * AFTER the Top-N trim. Pure: no DOM, no d3. Used by `renderers/svg.js`.
 */

import { toFiniteNumber } from '../../utils/formatters.js';
import { categoryKey, describeCategory } from '../../domain/datasets/cellValues.js';
import { compareCategoryKeys } from '../shared/categoryOrder.js';

/**
 * @typedef {{ key: string, label: string, token: string, value: number }} BarEntry
 */

// WHY: every count-based sort uses `|| compareCategoryKeys(a.key, b.key)` as a
// tiebreaker so categories with equal counts have a deterministic visual order.
// Without the secondary compare, sort stability varies by browser engine and
// the bar order can flicker between renders on identical data.
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

	return entries.sort((a, b) => b.value - a.value || compareCategoryKeys(a.key, b.key));
}

/**
 * Aggregate rows for the bar chart.
 *
 * @param {Array<Object<string, *>>} rows - Canonical source rows.
 * @param {string} categoryColumn - Categorical column name.
 * @param {{ measureMode: 'count'|'sum'|'mean', valueColumn: string|null, sort: string, topN: number, missingLabel: string }} params
 * @returns {{ ok: false, reason?: string } | { ok: true, entries: BarEntry[], total: number }}
 */
export function aggregateBarData(rows, categoryColumn, { measureMode, valueColumn, sort, topN, missingLabel }) {
	const hasValueColumn = (measureMode === 'count')
		? true
		: rows.some(row => Object.prototype.hasOwnProperty.call(row, valueColumn));

	const counter = new Map();
	const counterN = new Map();

	if (measureMode === 'count') {
		rows.forEach(row => {
			const key = categoryKey(row[categoryColumn]);
			counter.set(key, (counter.get(key) || 0) + 1);
		});
	} else {
		if (!valueColumn || !hasValueColumn) return { ok: false, reason: 'no-value-column' };
		rows.forEach(row => {
			const key = categoryKey(row[categoryColumn]);
			const value = toFiniteNumber(row[valueColumn]);
			if (!Number.isFinite(value)) return;
			counter.set(key, (counter.get(key) || 0) + value);
			counterN.set(key, (counterN.get(key) || 0) + 1);
		});

		if (measureMode === 'mean') {
			for (const [key, sum] of counter.entries()) {
				counter.set(key, sum / (counterN.get(key) || 1));
			}
		}
	}

	if ((measureMode === 'sum' || measureMode === 'mean') && counter.size === 0) {
		return { ok: false, reason: 'no-numeric' };
	}

	let entries = Array.from(counter, ([key, value]) => ({
		key,
		...describeCategory(key, { missingLabel }),
		value,
	}));
	entries = sortCategories(entries, sort);

	if (topN > 0) {
		entries = entries.slice(0, topN);
	}

	if (entries.length === 0) return { ok: false };
	const total = entries.reduce((acc, entry) => acc + entry.value, 0);

	return { ok: true, entries, total };
}
