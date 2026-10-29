import { applyGlobalFilterRules, resolveGlobalFilterForColumns } from './globalFilter.js';

/**
 * CHIVE dataset filtering.
 *
 * Answers which rows a dataset shows right now. The table preview, the stats,
 * the charts, the pie color grid and Panel captures all read this answer, so
 * they cannot disagree about which columns the global filter applies to. The
 * rule logic itself lives in `globalFilter.js`.
 *
 * @typedef {import('../../types.js').Dataset} Dataset
 * @typedef {import('../../types.js').GlobalFilter} GlobalFilter
 */

/**
 * Apply a dataset's global filter. Every rule applies, whether or not the
 * column list hides its column, and a rule reads its column as numeric when
 * the dataset types it as a number. A rule whose column the dataset no longer
 * has is dropped.
 *
 * @param {Pick<Dataset, 'rows' | 'columns' | 'chartConfig'>} dataset - Its chart config may be raw or merged with defaults.
 * @returns {{ filter: GlobalFilter, rows: Array<Object<string, *>> }} The rules that apply, and the rows that pass them. `rows` is the dataset's own array when no rule applies, which the stats view needs to reuse the precomputed stats.
 */
export function filterDataset({ rows, columns, chartConfig }) {
	const allColumns = Array.isArray(columns) ? columns : [];
	const numericNames = allColumns.filter(column => column?.type === 'number').map(column => column.name);
	const filter = resolveGlobalFilterForColumns(chartConfig?.globalFilter, allColumns.map(column => column?.name));
	return { filter, rows: applyGlobalFilterRules(rows, filter, numericNames) };
}
