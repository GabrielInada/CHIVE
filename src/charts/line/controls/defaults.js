/**
 * Line-chart controls: first-activation defaults.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 * @typedef {import('../../../types.js').ChartControlContext} ChartControlContext
 */

/**
 * Compute the line chart's activation defaults. The X-axis prefers the
 * user's current pick → first date column → first numeric → first
 * available. The Y-axis picks the first numeric column that is not also X.
 *
 * @param {Dataset} dataset
 * @param {ChartControlContext} ctx
 * @returns {{ x: string | null, y: string | null }}
 */
export function computeDefaults(dataset, ctx) {
	const currentX = dataset.chartConfig?.line?.x;
	const currentY = dataset.chartConfig?.line?.y;
	const xDefault = ctx.allColumns.includes(currentX)
		? currentX
		: (ctx.dates[0] ?? ctx.numeric[0] ?? ctx.allColumns[0] ?? null);
	const yCandidates = ctx.numeric.filter(name => name !== xDefault);
	const yDefault = ctx.numeric.includes(currentY) && currentY !== xDefault
		? currentY
		: (yCandidates[0] ?? ctx.numeric[0] ?? null);
	return { x: xDefault, y: yDefault };
}
