/**
 * Pie-chart data aggregation.
 *
 * Aggregates canonical rows into pie sectors by a count or numeric sum
 * measure, grouped by category key so the missing bucket never merges with
 * text that reads "N/A". Sorts descending with a key tiebreaker (missing
 * last) and applies Top-N handling (`truncate` drops the tail; `other` folds
 * it into a single caller-labelled "Other" sector, which has no filter
 * token). The returned `total` is summed AFTER Top-N handling, so percentages
 * are relative to the rendered sectors. Pure: no DOM, no d3. Used by
 * `renderers/svg.js` and `controls/sectorValues.js`.
 */

import { toFiniteNumber } from '../../utils/formatters.js';
import { categoryKey, describeCategory } from '../../domain/datasets/cellValues.js';
import { compareCategoryKeys } from '../shared/categoryOrder.js';

/**
 * @typedef {{ key: string, label: string, token: string|null, value: number, isOther?: boolean }} PieEntry
 */

/**
 * Aggregate rows for the pie chart.
 *
 * @param {Array<Object<string, *>>} rows - Canonical source rows.
 * @param {string} categoryColumn - Categorical column name.
 * @param {{ measureMode: 'count'|'sum', valueColumn: string|null, topN: number, topNMode: 'other'|'truncate', otherLabel: string, missingLabel?: string }} params
 * @returns {{ ok: false, reason?: string } | { ok: true, entries: PieEntry[], total: number }}
 */
export function aggregatePieData(rows, categoryColumn, { measureMode, valueColumn, topN, topNMode, otherLabel, missingLabel }) {
	const counter = new Map();
	rows.forEach(row => {
		const key = categoryKey(row[categoryColumn]);
		if (measureMode === 'sum') {
			if (!valueColumn) return;
			const value = toFiniteNumber(row[valueColumn]);
			if (!Number.isFinite(value)) return;
			counter.set(key, (counter.get(key) || 0) + value);
			return;
		}
		counter.set(key, (counter.get(key) || 0) + 1);
	});

	let entries = Array.from(counter, ([key, value]) => ({ key, ...describeCategory(key, { missingLabel }), value }))
		.sort((a, b) => b.value - a.value || compareCategoryKeys(a.key, b.key));
	if (entries.length === 0) {
		return { ok: false, reason: measureMode === 'sum' ? 'sum-no-numeric' : undefined };
	}

	if (topN > 0 && entries.length > topN) {
		if (topNMode === 'truncate') {
			entries = entries.slice(0, topN);
		} else {
			const head = entries.slice(0, topN);
			const remainderValue = entries.slice(topN).reduce((sum, item) => sum + item.value, 0);
			entries = [...head, { key: otherLabel, label: otherLabel, token: null, value: remainderValue, isOther: true }];
		}
	}

	const total = entries.reduce((acc, item) => acc + item.value, 0);
	return { ok: true, entries, total };
}
