// @vitest-environment jsdom

/**
 * The presentation flow is the single place that reads the browser-local TIN
 * color-rendering setting; the renderer stays stateless and receives the mode
 * as an explicit option. Workspace sections and panel adapters both render
 * through renderTinInto, so forwarding here covers both surfaces.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	renderTinChart: vi.fn(),
	getTinColorRendering: vi.fn(),
}));

vi.mock('../../../src/charts/tin/renderers/svg.js', () => ({
	renderTinChart: mocks.renderTinChart,
}));

vi.mock('../../../src/services/settingsService.js', () => ({
	getTinColorRendering: mocks.getTinColorRendering,
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: key => key,
	getLocale: () => 'en',
}));

import { renderTinInto } from '../../../src/charts/tin/presentation.js';
import { renderTinPanelChart } from '../../../src/charts/tin/panelAdapter.js';

describe('tin presentation colorRenderingMode forwarding', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.renderTinChart.mockReturnValue({ ok: true });
		mocks.getTinColorRendering.mockReturnValue('optimized');
	});

	it('forwards the current browser-local mode to the renderer', () => {
		mocks.getTinColorRendering.mockReturnValue('full-ramp');
		const container = document.createElement('div');

		renderTinInto(container, [], { x: 'x', y: 'y', z: 'z' });

		expect(mocks.renderTinChart).toHaveBeenCalledTimes(1);
		expect(mocks.renderTinChart.mock.calls[0][5]).toEqual(expect.objectContaining({
			colorRenderingMode: 'full-ramp',
		}));
	});

	it('re-reads the setting on every render, so a settings change repaints in the new mode', () => {
		const container = document.createElement('div');
		renderTinInto(container, [], { x: 'x', y: 'y', z: 'z' });
		expect(mocks.renderTinChart.mock.calls[0][5].colorRenderingMode).toBe('optimized');

		mocks.getTinColorRendering.mockReturnValue('full-ramp');
		renderTinInto(container, [], { x: 'x', y: 'y', z: 'z' });
		expect(mocks.renderTinChart.mock.calls[1][5].colorRenderingMode).toBe('full-ramp');
	});

	it('panel snapshots render through the same flow with the live mode and frozen config', () => {
		mocks.getTinColorRendering.mockReturnValue('full-ramp');
		const container = document.createElement('div');
		const spec = {
			dataSnapshot: [{ x: 1, y: 2, z: 3 }],
			config: { x: 'x', y: 'y', z: 'z', subdivisionDepth: 2 },
		};

		renderTinPanelChart(container, spec);

		expect(mocks.renderTinChart).toHaveBeenCalledTimes(1);
		const options = mocks.renderTinChart.mock.calls[0][5];
		expect(options.colorRenderingMode).toBe('full-ramp');
		expect(options.subdivisionDepth).toBe(2);
		expect(mocks.renderTinChart.mock.calls[0][1]).toBe(spec.dataSnapshot);
	});
});
