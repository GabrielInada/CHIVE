/**
 * Bar-chart controls: first-activation defaults.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 * @typedef {import('../../../types.js').ChartControlContext} ChartControlContext
 */

/**
 * Compute the bar chart's activation defaults. Preserves the user's
 * current `category` if it still matches a visible categorical column;
 * otherwise falls back to the first available column (or `null`).
 *
 * @param {Dataset} dataset
 * @param {ChartControlContext} ctx
 * @returns {{ category: string | null }}
 */
export function computeDefaults(dataset, ctx) {
	const current = dataset.chartConfig?.bar?.category;
	const category = ctx.baseCategoricalOrAll.includes(current)
		? current
		: (ctx.baseCategoricalOrAll[0] || null);
	return { category };
}
