// @vitest-environment jsdom

/**
 * The network graph's presentation flow past its render budget: it draws
 * nothing and shows a notice with the graph's size until the user approves
 * drawing the whole graph in that container.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../src/i18n/en.json';
import { CHART_DEFINITIONS } from '../../../src/config/charts/definitions.js';
import { NETWORK_GRAPH } from '../../../src/config/charts/definitions/network.js';
import { renderNetworkInto } from '../../../src/charts/network/presentation.js';

vi.mock('../../../src/services/i18nService.js', () => ({
	t: (key, ...params) => (en[key] ?? key).replace(/\$(\d+)/g, (_, n) => String(params[n - 1])),
	getLocale: () => 'en',
}));

// 40 sources and 51 targets joined by one link more than the budget allows.
const linksCount = NETWORK_GRAPH.maxLinks + 1;
const rows = Array.from({ length: linksCount }, (_, index) => ({
	source: `s${index % 40}`,
	target: `t${Math.floor(index / 40)}`,
}));
const input = { rows, config: { ...CHART_DEFINITIONS.network.createDefaultConfig(), source: 'source', target: 'target' } };

function mount() {
	const container = document.createElement('div');
	document.body.append(container);
	return container;
}

beforeEach(() => {
	document.body.replaceChildren();
});

afterEach(() => {
	for (const container of document.body.children) container.__chive_network_simulation__?.stop();
});

describe('network presentation past the render budget', () => {
	it('reads source, target, weight and group from stored config with configured styling', () => {
		const container = mount();
		const result = renderNetworkInto(container, {
			rows: [{ from: 'A', to: 'B', amount: 9, kind: 'North' }],
			config: Object.freeze({
				...CHART_DEFINITIONS.network.createDefaultConfig(),
				source: 'from', target: 'to', weight: 'amount', group: 'kind',
				customTitle: 'Connections', chartHeight: 300, nodeRadius: 11,
				showNodeLabels: true, sourceNodeColor: '#123456', targetNodeColor: '#654321',
			}),
		});
		expect(result.ok).toBe(true);
		expect(container.querySelector('.network-link').getAttribute('stroke-width')).toBe('3');
		const nodes = [...container.querySelectorAll('.network-node')];
		expect(nodes.map(node => node.getAttribute('r'))).toEqual(['11', '11']);
		expect(nodes.map(node => node.getAttribute('fill'))).toEqual(['#123456', '#654321']);
		expect(nodes.map(node => node.__data__.group)).toEqual(['North', 'North']);
		expect(container.querySelector('svg').getAttribute('height')).toBe('300');
		expect(container.textContent).toContain('Connections');
		expect(container.querySelector('.network-labels').textContent).toContain('A');
	});

	it('draws nothing until the notice is approved, then draws the whole graph', () => {
		const container = mount();

		const result = renderNetworkInto(container, input);

		expect(result).toEqual({ ok: true, budgetExceeded: true, nodesCount: 91, linksCount });
		expect(container.querySelector('.network-node')).toBeNull();
		const notice = container.querySelector('.chart-render-budget-notice');
		expect(notice.textContent).toContain(
			`This network has 91 nodes and ${linksCount} links. The automatic limit is ${NETWORK_GRAPH.maxNodes} nodes or ${NETWORK_GRAPH.maxLinks} links.`,
		);

		notice.querySelector('button').click();

		expect(container.querySelectorAll('.network-node')).toHaveLength(91);
		expect(container.querySelectorAll('.network-link')).toHaveLength(linksCount);
		expect(container.querySelectorAll('linearGradient')).toHaveLength(linksCount);
		expect(container.querySelector('.chart-render-budget-notice')).toBeNull();
	});
});
