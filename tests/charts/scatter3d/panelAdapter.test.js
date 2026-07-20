// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn((key, ...args) => (args.length ? `${key}:${args.join(',')}` : key)),
	renderScatter3dChart: vi.fn(),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
}));

vi.mock('../../../src/charts/scatter3d/renderers/three.js', () => ({
	renderScatter3dChart: mocks.renderScatter3dChart,
}));

import { renderScatter3dPanelChart } from '../../../src/charts/scatter3d/panelAdapter.js';

const spec = {
	id: 7,
	type: 'scatter3d',
	config: {
		x: 'a',
		y: 'b',
		z: 'c',
		customTitle: 'Snapshot',
		chartHeight: 420,
		pointSize: 0.02,
		opacity: 0.6,
		color: '#654321',
	},
	dataSnapshot: [{ a: 1, b: 2, c: 3 }],
	columnsSnapshot: [],
};

describe('renderScatter3dPanelChart', () => {
	let container;

	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
		// Panel slot containers have no id.
		container = document.createElement('div');
		document.body.appendChild(container);
		mocks.renderScatter3dChart.mockImplementation((el) => {
			const canvas = document.createElement('canvas');
			canvas.className = 'chart-canvas-3d';
			el.appendChild(canvas);
			return { ok: true, renderedCount: 1, validCount: 1, totalCount: 1, truncated: false };
		});
	});

	async function flushLazyRender() {
		await vi.waitFor(() => {
			expect(mocks.renderScatter3dChart).toHaveBeenCalled();
		});
	}

	it('maps the snapshot onto the renderer contract with localized labels', async () => {
		const result = renderScatter3dPanelChart(container, spec);
		await flushLazyRender();

		expect(result).toEqual({ ok: true, pending: true });
		expect(mocks.renderScatter3dChart).toHaveBeenCalledWith(container, spec.dataSnapshot, 'a', 'b', 'c', {
			customTitle: 'Snapshot',
			chartHeight: 420,
			pointSize: 0.02,
			opacity: 0.6,
			color: '#654321',
			labels: {
				controlsInstructions: 'chive-chart-scatter3d-controls-instructions',
				contextLost: 'chive-chart-scatter3d-context-lost',
				contextRestored: 'chive-chart-scatter3d-context-restored',
			},
		});
	});

	it('tolerates a spec without config or rows', async () => {
		const result = renderScatter3dPanelChart(container, { type: 'scatter3d' });
		await flushLazyRender();

		expect(mocks.renderScatter3dChart).toHaveBeenCalledWith(
			container,
			[],
			undefined,
			undefined,
			undefined,
			expect.any(Object),
		);
		expect(result.ok).toBe(true);
	});

	it('renders the sampling notice in the slot when the payload is truncated', async () => {
		mocks.renderScatter3dChart.mockImplementation((el) => {
			el.appendChild(document.createElement('canvas'));
			return { ok: true, renderedCount: 5, validCount: 50, totalCount: 60, truncated: true };
		});

		renderScatter3dPanelChart(container, spec);
		await flushLazyRender();

		const notice = container.querySelector('.chart-sampling-notice');
		expect(notice.textContent).toBe('chive-chart-scatter3d-sampling-notice:5,50');
	});

	it('shows the empty-state message in the id-less slot on failure', async () => {
		mocks.renderScatter3dChart.mockReturnValue({ ok: false, reason: 'webgl-unavailable' });

		const result = renderScatter3dPanelChart(container, spec);
		await flushLazyRender();

		expect(result).toEqual({ ok: true, pending: true });
		const empty = container.querySelector('.chart-empty');
		expect(empty.textContent).toBe('chive-chart-empty-scatter3d-webgl-unavailable');
	});
});
