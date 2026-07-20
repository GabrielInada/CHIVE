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

import { renderScatter3dChartSection } from '../../../src/charts/scatter3d/workspaceSection.js';
import { CHART_DISPOSE_HOOK } from '../../../src/charts/shared/containerLifecycle.js';

function okRender({ truncated = false, renderedCount = 3, validCount = 3, totalCount = 4 } = {}) {
	return (container) => {
		const canvas = document.createElement('canvas');
		canvas.className = 'chart-canvas-3d';
		container.appendChild(canvas);
		return { ok: true, renderedCount, validCount, totalCount, truncated };
	};
}

function setupDom() {
	document.body.innerHTML = `
		<section id="chart-block-scatter3d"></section>
		<div id="chart-scatter3d-container"></div>
	`;
	return {
		block: document.getElementById('chart-block-scatter3d'),
		container: document.getElementById('chart-scatter3d-container'),
	};
}

const enabledConfig = {
	enabled: true,
	x: 'a',
	y: 'b',
	z: 'c',
	customTitle: 'My cloud',
	chartHeight: 500,
	pointSize: 0.05,
	opacity: 0.9,
	color: '#123456',
};

async function flushLazyRender(expectedCalls = 1) {
	await vi.waitFor(() => {
		expect(mocks.renderScatter3dChart).toHaveBeenCalledTimes(expectedCalls);
	});
}

describe('renderScatter3dChartSection', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.renderScatter3dChart.mockImplementation(okRender());
	});

	it('hides the block and clears the container (running any dispose hook) when disabled', () => {
		const { block, container } = setupDom();
		container.innerHTML = '<canvas></canvas>';
		const dispose = vi.fn();
		container[CHART_DISPOSE_HOOK] = dispose;

		renderScatter3dChartSection({ config: { enabled: false }, rows: [] });

		expect(block.hidden).toBe(true);
		expect(container.innerHTML).toBe('');
		expect(dispose).toHaveBeenCalledTimes(1);
		expect(mocks.renderScatter3dChart).not.toHaveBeenCalled();
	});

	it('renders with the config fields, localized labels, and minHeight', async () => {
		const { block, container } = setupDom();
		const rows = [{ a: 1 }];

		renderScatter3dChartSection({ config: enabledConfig, rows });
		await flushLazyRender();

		expect(block.hidden).toBe(false);
		expect(container.style.minHeight).toBe('500px');
		expect(mocks.renderScatter3dChart).toHaveBeenCalledWith(container, rows, 'a', 'b', 'c', {
			customTitle: 'My cloud',
			chartHeight: 500,
			pointSize: 0.05,
			opacity: 0.9,
			color: '#123456',
			labels: {
				controlsInstructions: 'chive-chart-scatter3d-controls-instructions',
				contextLost: 'chive-chart-scatter3d-context-lost',
				contextRestored: 'chive-chart-scatter3d-context-restored',
			},
		});
	});

	it('sets the accurate aria-label from the ok payload counts', async () => {
		const { container } = setupDom();
		mocks.renderScatter3dChart.mockImplementation(okRender({ renderedCount: 42 }));

		renderScatter3dChartSection({ config: enabledConfig, rows: [] });
		await flushLazyRender();

		const canvas = container.querySelector('.chart-canvas-3d');
		expect(canvas.getAttribute('aria-label')).toBe('chive-chart-scatter3d-aria-label:a,b,c,42');
	});

	it('renders the sampling notice only when the payload reports truncation', async () => {
		const { container } = setupDom();
		mocks.renderScatter3dChart.mockImplementation(okRender({ truncated: true, renderedCount: 10, validCount: 99 }));

		renderScatter3dChartSection({ config: enabledConfig, rows: [] });
		await flushLazyRender();

		const notice = container.querySelector('.chart-sampling-notice');
		expect(notice.textContent).toBe('chive-chart-scatter3d-sampling-notice:10,99');

		document.body.innerHTML = '';
		setupDom();
		mocks.renderScatter3dChart.mockImplementation(okRender({ truncated: false }));
		renderScatter3dChartSection({ config: enabledConfig, rows: [] });
		await flushLazyRender(2);
		expect(document.querySelector('.chart-sampling-notice')).toBeNull();
	});

	it.each([
		['no-valid-points', 'chive-chart-empty-scatter3d-no-valid-points'],
		['webgl-unavailable', 'chive-chart-empty-scatter3d-webgl-unavailable'],
		['render-error', 'chive-chart-empty-scatter3d'],
		[undefined, 'chive-chart-empty-scatter3d'],
	])('maps the %s fail reason onto its empty-state key', async (reason, expectedKey) => {
		const { container } = setupDom();
		mocks.renderScatter3dChart.mockReturnValue(reason ? { ok: false, reason } : { ok: false });

		renderScatter3dChartSection({ config: enabledConfig, rows: [] });
		await flushLazyRender();

		const empty = container.querySelector('.chart-empty');
		expect(empty.textContent).toBe(expectedKey);
	});

	it('tolerates a missing block or container', () => {
		document.body.innerHTML = '';
		expect(() => renderScatter3dChartSection({ config: enabledConfig, rows: [] })).not.toThrow();
		expect(mocks.renderScatter3dChart).not.toHaveBeenCalled();
	});
});
