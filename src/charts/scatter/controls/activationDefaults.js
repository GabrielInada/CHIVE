/**
 * Scatter-plot activation defaults.
 *
 * Computes the column/scale selection applied the first time the scatter plot
 * is activated for a dataset. Pure: reads `dataset.chartConfig` and the column
 * context, returns a plain config patch, touches no DOM and no state.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 * @typedef {import('../../../types.js').ChartControlContext} ChartControlContext
 */

/**
 * Pick the `preferredIndex`th option, excluding `avoid`. Falls back to the
 * first available option, then `null`. Used by {@link computeDefaults} to
 * choose Y as the second numeric column (or first when only one exists).
 *
 * @private
 * @param {string[]} options
 * @param {number} [preferredIndex=0]
 * @param {string | null} [avoid=null]
 * @returns {string | null}
 */
function pickPreferred(options, preferredIndex = 0, avoid = null) {
	const filtered = options.filter(opt => opt !== avoid);
	return filtered[preferredIndex] ?? filtered[0] ?? null;
}

/**
 * Compute the scatter plot's activation defaults. X prefers the user's
 * current pick → first numeric → first column. Y picks the second numeric
 * column that is not also X. Each axis scale falls back to `'linear'` when
 * its column is non-numeric.
 *
 * @param {Dataset} dataset
 * @param {ChartControlContext} ctx
 * @returns {{ x: string | null, y: string | null, xScale: 'linear' | 'log', yScale: 'linear' | 'log' }}
 */
export function computeDefaults(dataset, ctx) {
	const config = dataset.chartConfig || {};
	const currentX = config.scatter?.x;
	const currentY = config.scatter?.y;
	const numericInAll = ctx.numeric.filter(opt => ctx.allColumns.includes(opt));
	const xPadrao = ctx.allColumns.includes(currentX)
		? currentX
		: (numericInAll[0] ?? ctx.allColumns[0] ?? null);
	const yPadrao = ctx.allColumns.includes(currentY) && currentY !== xPadrao
		? currentY
		: (pickPreferred(numericInAll, 1, xPadrao) ?? pickPreferred(ctx.allColumns, 0, xPadrao) ?? xPadrao);
	const currentXScale = config.scatter?.xScale === 'log' ? 'log' : 'linear';
	const currentYScale = config.scatter?.yScale === 'log' ? 'log' : 'linear';
	return {
		x: xPadrao,
		y: yPadrao,
		xScale: ctx.numeric.includes(xPadrao) ? currentXScale : 'linear',
		yScale: ctx.numeric.includes(yPadrao) ? currentYScale : 'linear',
	};
}
