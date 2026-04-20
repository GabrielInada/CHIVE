import { t } from '../../services/i18nService.js';
import { downloadSvgMarkup } from '../../utils/svgExport.js';
import { normalizeHexColor } from './resizeMath.js';
import { getChartSnapshot } from '../appState.js';
import { ok, fail } from '../../utils/result.js';

export function exportPanelLayoutSvg(feedbackCallback) {
	const canvas = document.getElementById('panel-layout-canvas');
	if (!canvas) {
		return fail('canvas-not-found');
	}

	const rectCanvas = canvas.getBoundingClientRect();
	if (rectCanvas.width <= 0 || rectCanvas.height <= 0) {
		return fail('empty-canvas');
	}

	try {
		const parser = new DOMParser();
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
				if (slotEl.classList.contains('vazio')) {
					border.setAttribute('stroke-dasharray', '6 4');
				}
				svgRoot.appendChild(border);
		});

		// Add each chart in rendered slots (all blocks)
		const slotElements = canvas.querySelectorAll('[data-panel-slot][data-panel-chart-id]');
		slotElements.forEach(slotEl => {
			const chart = getChartSnapshot(slotEl.dataset.panelChartId);
			if (!chart) return;

			const slotRect = slotEl.getBoundingClientRect();
			const x = slotRect.left - rectCanvas.left;
			const y = slotRect.top - rectCanvas.top;
			const w = slotRect.width;
			const h = slotRect.height;

			const parsed = parser.parseFromString(chart.svgMarkup, 'image/svg+xml');
			const chartSvg = parsed.documentElement;

			chartSvg.setAttribute('x', String(x));
			chartSvg.setAttribute('y', String(y));
			chartSvg.setAttribute('width', String(w));
			chartSvg.setAttribute('height', String(h));

			if (!chartSvg.getAttribute('preserveAspectRatio')) {
				chartSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
			}

			svgRoot.appendChild(docSvg.importNode(chartSvg, true));
		});

		const svgString = serializer.serializeToString(svgRoot);
		return downloadSvgMarkup(svgString, 'panel-layout');
	} catch (err) {
		if (feedbackCallback) {
			feedbackCallback(t('chive-panel-export-error'), 'error');
		}
		return fail('export-error');
	}
}
