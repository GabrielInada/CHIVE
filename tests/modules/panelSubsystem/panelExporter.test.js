// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const downloadMock = vi.hoisted(() => vi.fn(() => ({ ok: true })));

vi.mock('../../../src/utils/svgExport.js', () => ({
	downloadSvgMarkup: (...args) => downloadMock(...args),
	ensureSvgAttributes: (svg) => {
		if (!svg.getAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
	},
}));

import { exportPanelLayoutSvg } from '../../../src/modules/panelSubsystem/panelExporter.js';

function rect(left, top, width, height) {
	return {
		left,
		top,
		width,
		height,
		right: left + width,
		bottom: top + height,
		x: left,
		y: top,
		toJSON: () => ({}),
	};
}

/**
 * Build the minimal exporter DOM: the canvas root plus one chart-bearing
 * slot per entry. `content` is 'svg' or 'canvas' (a WebGL chart's slot).
 */
function setupCanvas(slotContents) {
	document.body.innerHTML = '<div id="panel-layout-canvas"></div>';
	const canvas = document.getElementById('panel-layout-canvas');
	canvas.getBoundingClientRect = () => rect(0, 0, 800, 600);

	slotContents.forEach((content, index) => {
		const slot = document.createElement('div');
		slot.dataset.panelSlot = `slot-${index + 1}`;
		slot.dataset.panelChartId = String(index + 1);
		slot.getBoundingClientRect = () => rect(10 + index * 210, 10, 200, 150);
		if (content === 'svg') {
			const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			svg.setAttribute('viewBox', '0 0 10 10');
			slot.appendChild(svg);
		} else if (content === 'canvas') {
			slot.appendChild(document.createElement('canvas'));
		}
		canvas.appendChild(slot);
	});
	return canvas;
}

describe('exportPanelLayoutSvg', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
		downloadMock.mockClear();
		downloadMock.mockReturnValue({ ok: true });
	});

	it('fails with canvas-not-found when the panel root is missing', () => {
		expect(exportPanelLayoutSvg()).toEqual({ ok: false, reason: 'canvas-not-found' });
		expect(downloadMock).not.toHaveBeenCalled();
	});

	it('exports an SVG slot and reports zero omissions', () => {
		setupCanvas(['svg']);

		const result = exportPanelLayoutSvg();

		expect(result).toEqual({ ok: true, omittedChartCount: 0 });
		expect(downloadMock).toHaveBeenCalledTimes(1);
	});

	it('completes a mixed export, omitting the canvas slot and counting it', () => {
		setupCanvas(['svg', 'canvas']);

		const result = exportPanelLayoutSvg();

		expect(result).toEqual({ ok: true, omittedChartCount: 1 });
		expect(downloadMock).toHaveBeenCalledTimes(1);
		const [svgMarkup] = downloadMock.mock.calls[0];
		const chartTagCount = (svgMarkup.match(/<svg[^>]*\sx="/g) || []).length;
		expect(chartTagCount).toBe(1);
	});

	it('fails with no-exportable-charts and downloads nothing for a canvas-only panel', () => {
		setupCanvas(['canvas', 'canvas']);

		const result = exportPanelLayoutSvg();

		expect(result).toEqual({ ok: false, reason: 'no-exportable-charts' });
		expect(downloadMock).not.toHaveBeenCalled();
	});

	it('still exports the shell for a panel with no chart-bearing slots', () => {
		setupCanvas([]);

		const result = exportPanelLayoutSvg();

		expect(result).toEqual({ ok: true, omittedChartCount: 0 });
		expect(downloadMock).toHaveBeenCalledTimes(1);
	});

	it('propagates a download failure unchanged instead of masking it as success', () => {
		setupCanvas(['svg']);
		downloadMock.mockReturnValue({ ok: false, reason: 'download-failed' });

		const result = exportPanelLayoutSvg();

		expect(result).toEqual({ ok: false, reason: 'download-failed' });
	});
});
