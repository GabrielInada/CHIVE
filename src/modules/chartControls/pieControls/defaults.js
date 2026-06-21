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

/**
 * Compute the pie chart's activation defaults. Preserves the user's
 * current `category` and `valueColumn` when they still match visible
 * columns; otherwise falls back to the first available column.
 *
 * @param {Dataset} dataset
 * @param {ChartControlContext} ctx
 * @returns {{ category: string | null, valueColumn: string | null }}
 */
export function computeDefaults(dataset, ctx) {
	const currentCat = dataset.chartConfig?.pie?.category;
	const currentVal = dataset.chartConfig?.pie?.valueColumn;
	return {
		category: ctx.baseCategoricalOrAll.includes(currentCat)
			? currentCat
			: (ctx.baseCategoricalOrAll[0] || null),
		valueColumn: ctx.numeric.includes(currentVal) ? currentVal : (ctx.numeric[0] || null),
	};
}
