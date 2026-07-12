/**
 * Canonical chart-type identities.
 *
 * This leaf module owns only chart keys and their visual precedence. It must
 * stay independent of renderers, controls, DOM metadata, services, and state
 * so membership checks can import it without pulling in an integration layer.
 *
 * @typedef {import('../types.js').ChartTypeKey} ChartTypeKey
 */

/**
 * Supported chart keys in canonical visual order. The same precedence is used
 * when a legacy config has more than one enabled chart.
 *
 * @type {ReadonlyArray<ChartTypeKey>}
 */
export const CHART_TYPE_KEYS = Object.freeze([
	'bar',
	'line',
	'scatter',
	'scatter3d',
	'pie',
	'bubble',
	'network',
	'treemap',
	'tin',
]);
