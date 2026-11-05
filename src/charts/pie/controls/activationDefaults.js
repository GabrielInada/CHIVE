/**
 * Pie-chart activation defaults.
 *
 * Computes the column selection applied the first time the pie chart is
 * activated for a dataset. Pure: reads `dataset.chartConfig` and the column
 * context, returns a plain config patch, touches no DOM and no state.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 * @typedef {import('../../../types.js').ChartControlContext} ChartControlContext
 */

import { valueColumnForMeasure } from '../../shared/controls/measureValueColumn.js';

/**
 * Compute the pie chart's activation defaults. Preserves the user's
 * current `category` when it still matches a visible column; otherwise falls
 * back to the first available column. The value column follows the shared
 * measure rule, {@link valueColumnForMeasure}.
 *
 * @param {Dataset} dataset
 * @param {ChartControlContext} ctx
 * @returns {{ category: string | null, valueColumn: string | null }}
 */
export function computeDefaults(dataset, ctx) {
	const config = dataset.chartConfig?.pie;
	return {
		category: ctx.baseCategoricalOrAll.includes(config?.category)
			? config.category
			: (ctx.baseCategoricalOrAll[0] || null),
		valueColumn: valueColumnForMeasure(config?.measureMode, config?.valueColumn, ctx.numeric),
	};
}
