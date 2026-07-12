/**
 * TIN-chart activation defaults.
 *
 * Computes the column selection applied the first time the TIN chart is
 * activated for a dataset. Pure: reads `dataset.chartConfig` and the column
 * context, returns a plain config patch, touches no DOM and no state.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 * @typedef {import('../../../types.js').ChartControlContext} ChartControlContext
 */

/**
 * Pick the `preferredIndex`th option, excluding all values in `avoid`.
 * Falls back to the first available option, then `null`. Used by
 * {@link computeDefaults} to choose three distinct numeric columns for
 * X/Y/Z.
 *
 * @private
 * @param {string[]} options
 * @param {number} preferredIndex
 * @param {string[]} [avoid=[]]
 * @returns {string | null}
 */
function pickPreferred(options, preferredIndex, avoid = []) {
	const filtered = options.filter(opt => !avoid.includes(opt));
	return filtered[preferredIndex] ?? filtered[0] ?? null;
}

/**
 * Compute the TIN chart's activation defaults. Picks the first three
 * distinct numeric columns for X/Y/Z, preserving any user pick that still
 * matches.
 *
 * @param {Dataset} dataset
 * @param {ChartControlContext} ctx
 * @returns {{ x: string | null, y: string | null, z: string | null }}
 */
export function computeDefaults(dataset, ctx) {
	const config = dataset.chartConfig?.tin || {};
	const numerics = ctx.numeric || [];
	const currentX = numerics.includes(config.x) ? config.x : (numerics[0] ?? null);
	const currentY = numerics.includes(config.y) && config.y !== currentX
		? config.y
		: pickPreferred(numerics, 1, [currentX]) ?? null;
	const currentZ = numerics.includes(config.z) && config.z !== currentX && config.z !== currentY
		? config.z
		: pickPreferred(numerics, 2, [currentX, currentY]) ?? null;
	return { x: currentX, y: currentY, z: currentZ };
}
