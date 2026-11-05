/**
 * Treemap controls: first-activation defaults.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 * @typedef {import('../../../types.js').ChartControlContext} ChartControlContext
 */

import { valueColumnForMeasure } from '../../shared/controls/measureValueColumn.js';

/**
 * Compute the treemap's activation defaults. Preserves the user's
 * current `category` if it still matches a visible categorical column;
 * otherwise falls back to the first available column. The value column
 * follows the shared measure rule, {@link valueColumnForMeasure}.
 *
 * @param {Dataset} dataset
 * @param {ChartControlContext} ctx
 * @returns {{ category: string | null, valueColumn: string | null }}
 */
export function computeDefaults(dataset, ctx) {
	const config = dataset.chartConfig?.treemap;
	return {
		category: ctx.baseCategoricalOrAll.includes(config?.category)
			? config.category
			: (ctx.baseCategoricalOrAll[0] || null),
		valueColumn: valueColumnForMeasure(config?.measureMode, config?.valueColumn, ctx.numeric),
	};
}
