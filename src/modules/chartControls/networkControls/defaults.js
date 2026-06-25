/**
 * Network-graph controls: first-activation defaults.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 * @typedef {import('../../../types.js').ChartControlContext} ChartControlContext
 */

/**
 * Compute the network graph's activation defaults. Preserves the user's
 * current `source`/`target` if they still match visible columns;
 * otherwise falls back to the first two visible columns.
 *
 * @param {Dataset} dataset
 * @param {ChartControlContext} ctx
 * @returns {{ source: string | null, target: string | null }}
 */
export function computeDefaults(dataset, ctx) {
	const currentSource = dataset.chartConfig?.network?.source;
	const currentTarget = dataset.chartConfig?.network?.target;
	const sourcePadrao = ctx.allColumns.includes(currentSource)
		? currentSource
		: (ctx.allColumns[0] || null);
	const targetPadrao = ctx.allColumns.includes(currentTarget)
		? currentTarget
		: (ctx.allColumns[1] || ctx.allColumns[0] || null);
	return { source: sourcePadrao, target: targetPadrao };
}
