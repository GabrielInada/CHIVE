/**
 * Treemap data aggregation.
 *
 * Aggregates rows into the squarify input entries by a count or numeric sum
 * measure, applying the same `N/A` bucketing, positive-value filter, descending
 * sort with string tiebreaker, and Top-N trim as the renderer did inline. The
 * returned `total` is summed AFTER the Top-N trim, so percentages are relative
 * to the rendered cells, not the original rows. Pure: no DOM, no d3. Used by
 * `treemapChart.js`.
 */

import { isNullish } from '../../../utils/formatters.js';
import { compareStrings } from '../../../utils/chartFilters.js';

/**
 * Aggregate rows for the treemap.
 *
 * @param {Array<Object<string, *>>} rows - Source rows.
 * @param {string} categoryColumn - Categorical column name.
 * @param {{ measureMode: 'count'|'sum', valueColumn: string|null, topN: number }} params
 * @returns {{ ok: false, reason?: string } | { ok: true, entries: Array<[string, number]>, total: number }}
 */
export function aggregateTreemapData(rows, categoryColumn, { measureMode, valueColumn, topN }) {
	const hasValueColumn = measureMode === 'count'
		? true
		: rows.some(row => Object.prototype.hasOwnProperty.call(row, valueColumn));

	if (measureMode === 'sum' && (!valueColumn || !hasValueColumn)) {
		return { ok: false, reason: 'no-value-column' };
	}

	const counter = new Map();
	rows.forEach(row => {
		const rawValue = row[categoryColumn];
		const category = isNullish(rawValue) || rawValue === ''
			? 'N/A'
			: String(rawValue);
		if (measureMode === 'sum') {
			const value = Number(row[valueColumn]);
			if (!Number.isFinite(value)) return;
			counter.set(category, (counter.get(category) || 0) + value);
		} else {
			counter.set(category, (counter.get(category) || 0) + 1);
		}
	});

	if (counter.size === 0) return { ok: false };

	let entries = Array.from(counter.entries())
		.filter(([, v]) => v > 0)
		.sort((a, b) => b[1] - a[1] || compareStrings(a[0], b[0]));

	if (topN > 0) entries = entries.slice(0, topN);
	if (entries.length === 0) return { ok: false };

	const total = entries.reduce((acc, [, v]) => acc + v, 0);

	return { ok: true, entries, total };
}
