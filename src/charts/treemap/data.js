/**
 * Treemap data aggregation.
 *
 * Aggregates canonical rows into the squarify input entries by a count or
 * numeric sum measure, grouped by category key so the missing bucket never
 * merges with text that reads "N/A". Applies a positive-value filter, a
 * descending sort with a key tiebreaker (missing last), and Top-N trim. The
 * returned `total` is summed AFTER the Top-N trim, so percentages are relative
 * to the rendered cells, not the original rows. Pure: no DOM, no d3. Used by
 * `renderers/svg.js`.
 */

import { toFiniteNumber } from '../../utils/formatters.js';
import { categoryKey, describeCategory } from '../../domain/datasets/cellValues.js';
import { compareCategoryKeys } from '../shared/categoryOrder.js';

/**
 * @typedef {{ key: string, label: string, token: string, value: number }} TreemapEntry
 */

/**
 * Aggregate rows for the treemap.
 *
 * @param {Array<Object<string, *>>} rows - Canonical source rows.
 * @param {string} categoryColumn - Categorical column name.
 * @param {{ measureMode: 'count'|'sum', valueColumn: string|null, topN: number, missingLabel: string }} params
 * @returns {{ ok: false, reason?: string } | { ok: true, entries: TreemapEntry[], total: number }}
 */
export function aggregateTreemapData(rows, categoryColumn, { measureMode, valueColumn, topN, missingLabel }) {
	const hasValueColumn = measureMode === 'count'
		? true
		: rows.some(row => Object.prototype.hasOwnProperty.call(row, valueColumn));

	if (measureMode === 'sum' && (!valueColumn || !hasValueColumn)) {
		return { ok: false, reason: 'no-value-column' };
	}

	const counter = new Map();
	rows.forEach(row => {
		const key = categoryKey(row[categoryColumn]);
		if (measureMode === 'sum') {
			const value = toFiniteNumber(row[valueColumn]);
			if (!Number.isFinite(value)) return;
			counter.set(key, (counter.get(key) || 0) + value);
		} else {
			counter.set(key, (counter.get(key) || 0) + 1);
		}
	});

	if (counter.size === 0) return { ok: false };

	let entries = Array.from(counter)
		.filter(([, v]) => v > 0)
		.map(([key, value]) => ({ key, ...describeCategory(key, { missingLabel }), value }))
		.sort((a, b) => b.value - a.value || compareCategoryKeys(a.key, b.key));

	if (topN > 0) entries = entries.slice(0, topN);
	if (entries.length === 0) return { ok: false };

	const total = entries.reduce((acc, entry) => acc + entry.value, 0);

	return { ok: true, entries, total };
}
