/**
 * CHIVE shown dataset.
 *
 * Answers what a dataset shows right now: the rows that pass its global
 * filter, the columns its column list shows, every column's type, and the
 * chart its config draws. The render coordinator derives it once per render
 * pass and hands the same value to the table, the statistics, the charts,
 * live preview and the chart controls; Add to panel derives it once per
 * capture. The chart config is read as stored: state canonicalizes it when it
 * is written, so deriving neither copies nor repairs it.
 *
 * @typedef {import('../../types.js').Dataset} Dataset
 * @typedef {import('../../types.js').ShownDataset} ShownDataset
 */

import { CHART_TYPE_KEYS } from '../../config/charts/definitions.js';
import { filterDataset } from '../filters/datasetFilter.js';
import { filterVisibleColumns, getColumnTypesByName } from './columns.js';

/**
 * Derive what `dataset` shows. A global filter rule keeps applying while the
 * column list hides its column, and a hidden column keeps its type. A legacy
 * config that enables more than one chart draws the first one in canonical
 * order.
 *
 * @param {Dataset} dataset - Read only. Its chart config is canonical, as state stores it.
 * @returns {ShownDataset}
 */
export function deriveShownDataset(dataset) {
	const columns = Array.isArray(dataset.columns) ? dataset.columns : [];
	const { filter, rows } = filterDataset(dataset);
	return {
		dataset,
		rows,
		filter,
		visibleColumns: filterVisibleColumns({ columns, selectedColumns: dataset.selectedColumns }),
		columnTypeByName: getColumnTypesByName(columns),
		activeChartType: CHART_TYPE_KEYS.find(type => dataset.chartConfig?.[type]?.enabled) ?? null,
	};
}
