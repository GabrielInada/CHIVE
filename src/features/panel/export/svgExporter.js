/**
 * CHIVE panel SVG exporter.
 *
 * Walks the rendered `#panel-layout-canvas` and composes a single
 * standalone SVG file with the block borders and every slot chart that
 * HAS a live SVG. Chart slots without one (canvas-based charts such as
 * scatter3d, or failed-render empty states) are omitted and counted in
 * the result payload so the caller can tell the user; a raster path for
 * canvas charts is a later tranche. The output is positioned in absolute
 * coordinates relative to the canvas.
 *
 * Pure with respect to user feedback: returns Results only. panelController
 * owns every user-facing message.
 *
 * @typedef {import('../../../types.js').Result} Result
 */

import { downloadSvgMarkup, ensureSvgAttributes } from '../../../utils/svgExport.js';
import { normalizeHexColor } from '../layout/resizeMath.js';
import { ok, fail } from '../../../utils/result.js';
import { PANEL_DOM_IDS } from '../domIds.js';

/**
 * Export the live panel canvas as a single SVG file. Clones each slot's
 * live SVG, positions clones at their on-screen coordinates relative to
 * the canvas, adds border rectangles for blocks with borders enabled,
 * and triggers a browser download via {@link downloadSvgMarkup}.
 *
 * @returns {Result} `ok({ omittedChartCount })` on success, where
 *   `omittedChartCount` is the number of chart-bearing slots that had no
 *   SVG to include. `{ ok: false, reason }` where reason is
 *   `'canvas-not-found'`, `'empty-canvas'`, `'no-exportable-charts'`
 *   (chart slots exist but none contains an SVG, nothing is downloaded),
 *   or `'export-error'`.
 */
export function exportPanelLayoutSvg() {
	const canvas = document.getElementById(PANEL_DOM_IDS.canvas);
	if (!canvas) {
		return fail('canvas-not-found');
	}

	const rectCanvas = canvas.getBoundingClientRect();
	if (rectCanvas.width <= 0 || rectCanvas.height <= 0) {
		return fail('empty-canvas');
	}

	try {
		const serializer = new XMLSerializer();
		const docSvg = document.implementation.createDocument(
			'http://www.w3.org/2000/svg',
			'svg',
			null
		);
		const svgRoot = docSvg.documentElement;

		svgRoot.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
		svgRoot.setAttribute('width', String(Math.round(rectCanvas.width)));
		svgRoot.setAttribute('height', String(Math.round(rectCanvas.height)));
		svgRoot.setAttribute(
			'viewBox',
			`0 0 ${Math.round(rectCanvas.width)} ${Math.round(rectCanvas.height)}`
		);

		// Add background
		const bg = docSvg.createElementNS('http://www.w3.org/2000/svg', 'rect');
		bg.setAttribute('x', '0');
		bg.setAttribute('y', '0');
		bg.setAttribute('width', '100%');
		bg.setAttribute('height', '100%');
		bg.setAttribute('fill', '#fbfaf6');
		svgRoot.appendChild(bg);

		const allSlots = canvas.querySelectorAll('[data-panel-slot]');
		allSlots.forEach(slotEl => {
			const includeSlotBorder = slotEl.dataset.panelBorderEnabled === '1';
			if (!includeSlotBorder) return;
			const slotBorderColor = normalizeHexColor(slotEl.dataset.panelBorderColor, '#5d645d');
				const slotRect = slotEl.getBoundingClientRect();
				const x = slotRect.left - rectCanvas.left;
				const y = slotRect.top - rectCanvas.top;
				const w = slotRect.width;
				const h = slotRect.height;

				const border = docSvg.createElementNS('http://www.w3.org/2000/svg', 'rect');
				border.setAttribute('x', String(x));
				border.setAttribute('y', String(y));
				border.setAttribute('width', String(w));
				border.setAttribute('height', String(h));
				border.setAttribute('fill', 'none');
				border.setAttribute('stroke', slotBorderColor);
				border.setAttribute('stroke-width', '2');
				border.setAttribute('rx', '8');
				border.setAttribute('ry', '8');
				if (slotEl.classList.contains('empty')) {
					border.setAttribute('stroke-dasharray', '6 4');
				}
				svgRoot.appendChild(border);
		});

		// Add each chart in rendered slots (all blocks), clone the LIVE SVG from
		// the DOM. Slots without one (canvas charts, failed renders) are counted
		// as omitted rather than silently dropped.
		const slotElements = canvas.querySelectorAll('[data-panel-slot][data-panel-chart-id]');
		let omittedChartCount = 0;
		let exportedChartCount = 0;
		slotElements.forEach(slotEl => {
			const liveSvg = slotEl.querySelector('svg');
			if (!liveSvg) {
				omittedChartCount += 1;
				return;
			}
			exportedChartCount += 1;

			const slotRect = slotEl.getBoundingClientRect();
			const x = slotRect.left - rectCanvas.left;
			const y = slotRect.top - rectCanvas.top;
			const w = slotRect.width;
			const h = slotRect.height;

			const chartSvg = liveSvg.cloneNode(true);
			ensureSvgAttributes(chartSvg);

			chartSvg.setAttribute('x', String(x));
			chartSvg.setAttribute('y', String(y));
			chartSvg.setAttribute('width', String(w));
			chartSvg.setAttribute('height', String(h));

			if (!chartSvg.getAttribute('preserveAspectRatio')) {
				chartSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
			}

			svgRoot.appendChild(docSvg.importNode(chartSvg, true));
		});

		// Chart slots exist but none produced an SVG: an export would be an
		// empty shell, so fail before downloading anything. An empty panel
		// (no chart-bearing slots at all) still exports its shell as before.
		if (slotElements.length > 0 && exportedChartCount === 0) {
			return fail('no-exportable-charts');
		}

		const svgString = serializer.serializeToString(svgRoot);
		const downloadResult = downloadSvgMarkup(svgString, 'panel-layout');
		if (!downloadResult.ok) return downloadResult;
		return ok({ omittedChartCount });
	} catch {
		return fail('export-error');
	}
}
