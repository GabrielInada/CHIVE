/**
 * TIN isoline/threshold hover interactions.
 *
 * Builds the pointer handlers that show a Z-value tooltip when the cursor is
 * over a `.tin-isoline-hit` line (the fattened transparent hit target behind
 * each visible isoline or threshold segment). Stateless; the renderer attaches
 * the returned function to each hit group. Used by `tinChart.js`.
 */

import { createTooltipLine, hideChartTooltip, moveChartTooltip, showChartTooltip } from '../tooltip.js';
import { formatNumber } from '../../../utils/formatters.js';

/**
 * Create the isoline/threshold hover attach function for a TIN render.
 *
 * @param {Object} params
 * @param {{x: string, y: string, z: string}} params.axisLabels - Resolved axis labels.
 * @param {string|undefined} params.locale - Number-format locale.
 * @returns {(group: Object) => void} Attaches pointerover/move/out handlers to a d3 selection.
 */
export function createIsolineHoverHandlers({ axisLabels, locale }) {
	return (group) => {
		group
			.on('pointerover', event => {
				const target = event.target;
				if (!target?.classList?.contains?.('tin-isoline-hit')) return;
				const z = Number(target.dataset.z);
				if (!Number.isFinite(z)) return;
				const wrapper = document.createElement('div');
				wrapper.appendChild(createTooltipLine(axisLabels.z, formatNumber(z, locale)));
				showChartTooltip(wrapper, event.pageX, event.pageY);
			})
			.on('pointermove', event => {
				if (event.target?.classList?.contains?.('tin-isoline-hit')) {
					moveChartTooltip(event.pageX, event.pageY);
				}
			})
			.on('pointerout', event => {
				if (event.target?.classList?.contains?.('tin-isoline-hit')) {
					hideChartTooltip();
				}
			});
	};
}
