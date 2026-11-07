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
		expect(container.querySelector('.chart-render-budget-notice')).toBeNull();
	});
});
