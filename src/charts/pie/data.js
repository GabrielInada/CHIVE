/**
 * Pie-chart data aggregation.
 *
 * Keeps the categories of the shared category aggregation whose value is
 * above 0, since a sector needs an angle, and applies Top-N handling to them
 * (`truncate` drops the tail; `other` folds it into a single caller-labelled
 * "Other" sector, which has its own key and no filter token). The returned
 * `total` is summed AFTER Top-N handling, so each sector's percentage is its
 * share of the circle. Pure: no DOM, no d3. Used by `renderers/svg.js` and
 * `controls/sectorValues.js`.
 */

import { aggregateCategories } from '../shared/categoryAggregation.js';

/**
 * @typedef {{ key: string, label: string, token: string|null, value: number, firstRow?: Object<string, *>, isOther?: boolean }} PieEntry
 */

/**
 * Key of the synthetic Other sector. Like the missing key, no category value
 * produces it by accident, so a real category spelled like the Other label
 * keeps its own pin and color identity.
 */
export const OTHER_SECTOR_KEY = '__chive_other__';

/**
 * Aggregate rows into the pie's categories, whatever the sign of their value,
 * before Top-N. A measure other than sum counts rows, because the color
 * controls pass the saved config without normalizing it.
 *
 * @param {Array<Object<string, *>>} rows - Canonical source rows.
 * @param {string} categoryColumn - Categorical column name.
 * @param {{ measureMode: 'count'|'sum', valueColumn: string|null, missingLabel?: string }} params
 * @returns {{ ok: false, reason?: string } | { ok: true, entries: PieEntry[] }} Fails like `aggregateCategories`.
 */
export function aggregatePieCategories(rows, categoryColumn, { measureMode, valueColumn, missingLabel }) {
	return aggregateCategories(rows, categoryColumn, {
		measureMode: measureMode === 'sum' ? 'sum' : 'count',
		valueColumn,
		missingLabel,
	});
}

/**
 * Aggregate rows for the pie chart: the categories of
 * {@link aggregatePieCategories} whose value is above 0, with Top-N applied.
 *
 * @param {Array<Object<string, *>>} rows - Canonical source rows.
 * @param {string} categoryColumn - Categorical column name.
 * @param {{ measureMode: 'count'|'sum', valueColumn: string|null, topN: number, topNMode: 'other'|'truncate', otherLabel: string, missingLabel?: string }} params
 * @returns {{ ok: false, reason?: string } | { ok: true, entries: PieEntry[], total: number }} Fails like `aggregateCategories`, and with `'no-positive-value'` when no value is above 0.
 */
export function aggregatePieData(rows, categoryColumn, { measureMode, valueColumn, topN, topNMode, otherLabel, missingLabel }) {
	const aggregated = aggregatePieCategories(rows, categoryColumn, { measureMode, valueColumn, missingLabel });
	if (!aggregated.ok) return aggregated;

	let entries = aggregated.entries.filter(item => item.value > 0);
	if (entries.length === 0) return { ok: false, reason: 'no-positive-value' };
	if (topN > 0 && entries.length > topN) {
		if (topNMode === 'truncate') {
			entries = entries.slice(0, topN);
		} else {
			const head = entries.slice(0, topN);
			const remainderValue = entries.slice(topN).reduce((sum, item) => sum + item.value, 0);
			entries = [...head, { key: OTHER_SECTOR_KEY, label: otherLabel, token: null, value: remainderValue, isOther: true }];
		}
	}

	const total = entries.reduce((acc, item) => acc + item.value, 0);
	return { ok: true, entries, total };
}
