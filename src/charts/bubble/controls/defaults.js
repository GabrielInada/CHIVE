/**
 * Bubble-chart controls: first-activation defaults.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 * @typedef {import('../../../types.js').ChartControlContext} ChartControlContext
 */

/**
 * Compute the bubble chart's activation defaults. Preserves the user's
 * current `category` and `valueColumn` when they still match visible
 * columns; otherwise falls back to the first available column. In
 * `measureMode === 'count'` the `valueColumn` is left untouched.
 *
 * @param {Dataset} dataset
 * @param {ChartControlContext} ctx
 * @returns {{ category: string | null, valueColumn: string | null }}
 */
export function computeDefaults(dataset, ctx) {
	const currentCat = dataset.chartConfig?.bubble?.category;
	const currentVal = dataset.chartConfig?.bubble?.valueColumn;
	const measureMode = dataset.chartConfig?.bubble?.measureMode;
	const valueColumn = measureMode !== 'count'
		? (ctx.numeric.includes(currentVal) ? currentVal : (ctx.numeric[0] || null))
		: currentVal;
	return {
		category: ctx.baseCategoricalOrAll.includes(currentCat)
			? currentCat
			: (ctx.baseCategoricalOrAll[0] || null),
		valueColumn,
	};
}
