/**
 * CHIVE panel chart-rendering bridge.
 *
 * The panel slot lifecycle delegates here with a captured chart snapshot. Chart
 * implementation lookup and adapter wiring live in the panel-only registry;
 * this bridge owns argument validation and the public result envelope.
 *
 * @typedef {import('../../../types.js').ChartSnapshot} ChartSnapshot
 * @typedef {import('../../../types.js').Result} Result
 */

import { getPanelChartRenderer } from '../../../charts/registries/panel.js';
import { fail } from '../../../utils/result.js';

/**
 * Render a chart snapshot into `container` by dispatching on `snapshot.type`.
 *
 * @param {HTMLElement} container - Mount point for SVG or canvas output.
 * @param {ChartSnapshot} snapshot - Saved capture built by `addChartSnapshot`; treated as read-only.
 * @returns {Result} Renderer result, `invalid-args`, or `unknown-type`.
 */
export function renderChartSnapshot(container, snapshot) {
	if (!container || !snapshot) return fail('invalid-args');
	const renderer = getPanelChartRenderer(snapshot.type);
	if (!renderer) return fail('unknown-type');
	return renderer(container, snapshot);
}
