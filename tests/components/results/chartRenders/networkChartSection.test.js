// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	renderNetworkGraph: vi.fn(() => ({ ok: true })),
	t: vi.fn(key => key),
	getLocale: vi.fn(() => 'en'),
}));

vi.mock('../../../../src/modules/visualizations/index.js', () => ({
	renderNetworkGraph: mocks.renderNetworkGraph,
}));

vi.mock('../../../../src/services/i18nService.js', () => ({
	t: mocks.t,
	getLocale: mocks.getLocale,
}));

import { renderNetworkChartSection } from '../../../../src/components/results/chartRenders/networkChartSection.js';
import { CHART_BLOCKS, CHART_CONTAINERS } from '../../../../src/config/elementIds.js';

function setupDom() {
	document.body.innerHTML = '';
	const block = document.createElement('div');
	block.id = CHART_BLOCKS.network;
	const container = document.createElement('div');
	container.id = CHART_CONTAINERS.network;
	document.body.append(block, container);
	return { block, container };
}

function defaultConfig(overrides = {}) {
	return {
		enabled: true,
		source: 'src',
		target: 'tgt',
		weight: 'w',
		group: null,
		chartHeight: 420,
		nodeRadius: 8,
		linkDistance: 80,
		chargeStrength: -100,
		linkOpacity: 0.6,
		showNodeLabels: true,
		sourceNodeColor: '#1f77b4',
		targetNodeColor: '#ff7f0e',
		edgeColorMode: 'uniform',
		zoomScale: 1,
		alphaDecay: 0.02,
		showLegend: true,
		customTitle: '',
		...overrides,
	};
}

const filterCallbacks = { onAddToGlobalFilter: null };

describe('renderNetworkChartSection', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.renderNetworkGraph.mockReturnValue({ ok: true });
	});

	it('hides block and skips renderer when disabled', () => {
		const { block, container } = setupDom();
		container.appendChild(document.createElement('span'));

		renderNetworkChartSection({
			config: defaultConfig({ enabled: false }),
			rows: [],
			filterCallbacks,
		});

		expect(block.style.display).toBe('none');
		expect(container.children.length).toBe(0);
		expect(mocks.renderNetworkGraph).not.toHaveBeenCalled();
	});

	it('renders the chart with source/target args and forwards weight/group columns', () => {
		const { block, container } = setupDom();
		const rows = [{ src: 'A', tgt: 'B', w: 1 }];

		renderNetworkChartSection({
			config: defaultConfig({ chartHeight: 480 }),
			rows,
			filterCallbacks,
		});

		expect(block.style.display).toBe('block');
		expect(container.style.minHeight).toBe('480px');
		const [calledContainer, calledRows, source, target, opts] = mocks.renderNetworkGraph.mock.calls[0];
		expect(calledContainer).toBe(container);
		expect(calledRows).toBe(rows);
		expect(source).toBe('src');
		expect(target).toBe('tgt');
		expect(opts.weightColumn).toBe('w');
		expect(opts.groupColumn).toBeNull();
		expect(opts.sourceColumn).toBe('src');
		expect(opts.targetColumn).toBe('tgt');
		expect(opts.filterCallbacks).toBe(filterCallbacks);
	});

	it('shows the generic empty-state for any failure reason', () => {
		const { container } = setupDom();
		mocks.renderNetworkGraph.mockReturnValueOnce({ ok: false, reason: 'whatever' });

		renderNetworkChartSection({
			config: defaultConfig(),
			rows: [],
			filterCallbacks,
		});

		expect(container.querySelector('.chart-vazio').textContent).toBe('chive-chart-empty-network');
	});

	it('falls back to the i18n key when source/target column names are empty', () => {
		setupDom();

		renderNetworkChartSection({
			config: defaultConfig({ source: '', target: '' }),
			rows: [],
			filterCallbacks,
		});

		const opts = mocks.renderNetworkGraph.mock.calls[0][4];
		expect(opts.labels.source).toBe('chive-chart-control-network-source');
		expect(opts.labels.target).toBe('chive-chart-control-network-target');
	});
});
