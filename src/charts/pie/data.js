/**
 * Pie-chart data aggregation.
 *
 * Aggregates rows into pie sectors by a count or numeric sum measure, applying
 * the same `N/A` bucketing, descending sort with string tiebreaker, and Top-N
 * handling (`truncate` drops the tail; `other` folds it into a single
 * caller-labelled "Other" sector) as the renderer did inline. The returned
 * `total` is summed AFTER Top-N handling, so percentages are relative to the
 * rendered sectors. Pure: no DOM, no d3. Used by `renderers/svg.js`.
 */

import { isNullish } from '../../utils/formatters.js';
import { compareStrings } from '../../domain/filters/chartFilter.js';

/**
 * Aggregate rows for the pie chart.
 *
 * @param {Array<Object<string, *>>} rows - Source rows.
 * @param {string} categoryColumn - Categorical column name.
 * @param {{ measureMode: 'count'|'sum', valueColumn: string|null, topN: number, topNMode: 'other'|'truncate', otherLabel: string }} params
 * @returns {{ ok: false, reason?: string } | { ok: true, entries: Array<{category: string, value: number, isOther?: boolean}>, total: number }}
 */
export function aggregatePieData(rows, categoryColumn, { measureMode, valueColumn, topN, topNMode, otherLabel }) {
	const counter = new Map();
	rows.forEach(row => {
		const rawValue = row[categoryColumn];
		const category = isNullish(rawValue) || rawValue === ''
			? 'N/A'
			: String(rawValue);
		if (measureMode === 'sum') {
			if (!valueColumn) return;
			const value = Number(row[valueColumn]);
			if (!Number.isFinite(value)) return;
			counter.set(category, (counter.get(category) || 0) + value);
			return;
		}
		counter.set(category, (counter.get(category) || 0) + 1);
	});

	let entries = Array.from(counter.entries())
		.map(([category, value]) => ({ category, value }))
		.sort((a, b) => b.value - a.value || compareStrings(a.category, b.category));
	if (entries.length === 0) {
		return { ok: false, reason: measureMode === 'sum' ? 'sum-no-numeric' : undefined };
	}

	if (topN > 0 && entries.length > topN) {
		if (topNMode === 'truncate') {
			entries = entries.slice(0, topN);
		} else {
			const head = entries.slice(0, topN);
			const remainderValue = entries.slice(topN).reduce((sum, item) => sum + item.value, 0);
			entries = [...head, { category: otherLabel, value: remainderValue, isOther: true }];
		}
	}

	const total = entries.reduce((acc, item) => acc + item.value, 0);
	return { ok: true, entries, total };
}
