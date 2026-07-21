// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn(key => key),
	getLocale: vi.fn(() => 'en'),
	renderNetworkGraph: vi.fn(() => ({ ok: true })),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
	getLocale: mocks.getLocale,
}));

vi.mock('../../../src/charts/network/renderers/svg.js', () => ({
	renderNetworkGraph: mocks.renderNetworkGraph,
}));

import { renderNetworkPanelChart } from '../../../src/charts/network/panelAdapter.js';

const rows = [
	{ from: 'A', to: 'B', w: 2 },
	{ from: 'B', to: 'C', w: 1 },
];

function createSpec(configOverrides = {}, specOverrides = {}) {
	return {
		type: 'network',
		dataSnapshot: rows,
		config: {
			source: 'from',
			target: 'to',
			weight: 'w',
			group: 'grp',
			nodeRadius: 7,
			linkDistance: 90,
			chargeStrength: -140,
			linkOpacity: 0.5,
			showNodeLabels: true,
			sourceNodeColor: '#e3743d',
			targetNodeColor: '#6b94c9',
			edgeColorMode: 'uniform',
			zoomScale: 1.4,
			alphaDecay: 0.03,
			showLegend: false,
			customTitle: 'Snapshot',
			chartHeight: 480,
			...configOverrides,
		},
		...specOverrides,
	};
}

describe('renderNetworkPanelChart', () => {
	let container;

	beforeEach(() => {
		vi.clearAllMocks();
		container = document.createElement('div');
	});

	it('maps a captured snapshot onto the shared network renderer contract', () => {
		const result = renderNetworkPanelChart(container, createSpec());

		expect(result).toEqual({ ok: true });
		expect(mocks.renderNetworkGraph).toHaveBeenCalledWith(
			container,
			rows,
			'from',
			'to',
			expect.objectContaining({
				weightColumn: 'w',
				groupColumn: 'grp',
				nodeRadius: 7,
				linkDistance: 90,
				chargeStrength: -140,
				linkOpacity: 0.5,
				showNodeLabels: true,
				sourceNodeColor: '#e3743d',
				targetNodeColor: '#6b94c9',
				edgeColorMode: 'uniform',
				zoomScale: 1.4,
				alphaDecay: 0.03,
				showLegend: false,
				customTitle: 'Snapshot',
				chartHeight: 480,
				locale: 'en',
				sourceColumn: 'from',
				targetColumn: 'to',
				filterCallbacks: {},
			}),
		);
	});

	it('forwards the localized tooltip labels with column-name overrides', () => {
		renderNetworkPanelChart(container, createSpec());

		expect(mocks.renderNetworkGraph.mock.calls[0][4].labels).toEqual({
			node: 'chive-chart-control-network-source',
			linkWeight: 'chive-chart-control-network-weight',
			source: 'from',
			target: 'to',
		});
	});

	it('falls back to localized source/target labels when columns are missing', () => {
		renderNetworkPanelChart(container, createSpec({ source: '', target: '' }));

		expect(mocks.renderNetworkGraph.mock.calls[0][4].labels).toEqual({
			node: 'chive-chart-control-network-source',
			linkWeight: 'chive-chart-control-network-weight',
			source: 'chive-chart-control-network-source',
			target: 'chive-chart-control-network-target',
		});
	});

	it('tolerates a snapshot without a config object', () => {
		renderNetworkPanelChart(container, { type: 'network', dataSnapshot: rows });

		expect(mocks.renderNetworkGraph).toHaveBeenCalledWith(
			container,
			rows,
			undefined,
			undefined,
			expect.objectContaining({ filterCallbacks: {} }),
		);
	});

	it('returns renderer failures unchanged', () => {
		mocks.renderNetworkGraph.mockReturnValueOnce({ ok: false, reason: 'insufficient-data' });

		expect(renderNetworkPanelChart(container, createSpec())).toEqual({
			ok: false,
			reason: 'insufficient-data',
		});
	});
});
