/**
 * Bubble-chart controls: shared nesting-column resolution.
 *
 * Package-private helper shared by the bubble builder (via `createNestingControls`)
 * and the bubble listeners. It is documented `@internal` and is deliberately not
 * re-exported by the `bubbleControls.js` facade; the export-surface lock in the test
 * suite pins it off the public surface. (`@internal` is a documentation convention
 * only; JavaScript does not enforce module privacy.)
 */

/**
 * Resolve the effective nesting-column list for a bubble config. Reads
 * `nestingColumns` when present; otherwise falls back to legacy
 * `groupColumn` so old persisted configs still work.
 *
 * @internal
 * @param {Object} config - The bubble chart config block.
 * @returns {string[]}
 */
export function resolveNestingColumnsFromConfig(config) {
	if (Array.isArray(config.nestingColumns) && config.nestingColumns.length > 0) {
		return [...config.nestingColumns];
	}
	if (config.groupColumn && typeof config.groupColumn === 'string') {
		return [config.groupColumn];
	}
	return [];
}
