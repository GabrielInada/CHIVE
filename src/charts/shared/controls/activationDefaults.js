/**
 * Activation defaults of the bar, pie, treemap and bubble charts.
 *
 * The column selection applied the first time one of these charts is
 * activated for a dataset. Pure: reads `dataset.chartConfig` and the column
 * context, returns a plain config patch, touches no DOM and no state.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 * @typedef {import('../../../types.js').ChartControlContext} ChartControlContext
 */

import { valueColumnForMeasure } from '../measure.js';

/**
 * The `computeDefaults` of the chart stored under `chartKey`. It keeps the
 * chart's category while that is still a visible column, else takes the first
 * one (or null), and keeps the value column {@link valueColumnForMeasure}
 * picks for the chart's measure.
 *
 * @param {'bar' | 'pie' | 'treemap' | 'bubble'} chartKey
 * @returns {(dataset: Dataset, ctx: ChartControlContext) => { category: string | null, valueColumn: string | null }}
 */
export function categoryChartDefaults(chartKey) {
	return (dataset, ctx) => {
		const config = dataset.chartConfig?.[chartKey];
		return {
			category: ctx.baseCategoricalOrAll.includes(config?.category)
				? config.category
				: (ctx.baseCategoricalOrAll[0] || null),
			valueColumn: valueColumnForMeasure(config?.measureMode, config?.valueColumn, ctx.numeric),
		};
	};
}
