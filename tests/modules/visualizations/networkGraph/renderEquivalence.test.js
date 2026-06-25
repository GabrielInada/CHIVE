// @vitest-environment jsdom

/**
 * Structural-equivalence guard for the networkGraph data-model extraction.
 *
 * Unlike the other renderers, network cannot use a full `outerHTML` snapshot:
 * it starts a D3 force simulation that mutates node positions asynchronously
 * and uses `Math.random()` for per-link gradient ids. So this guard mocks
 * `Math.random`, stops the simulation after each render, and pins only
 * immediately-stable structure derived from `buildNetworkData` (the thing the
 * extraction moves): the result object, the node/link counts, the node
 * ids+fills, and the link strokes. Gradient `<defs>` are created inside the
 * tick handler, so they are intentionally not asserted.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderNetworkGraph } from '../../../../src/modules/visualizations/networkGraph.js';
import { hideChartTooltip } from '../../../../src/modules/visualizations/tooltip.js';

const ROWS = [
	{ src: 'A', dst: 'B', w: 5, grp: 'X' },
	{ src: 'A', dst: 'C', w: 2, grp: 'X' },
	{ src: 'B', dst: 'C', w: 1, grp: 'Y' },
	{ src: 'A', dst: 'B', w: 3, grp: 'X' },
];

const BASE = { locale: 'en-US', chartHeight: 400, showNodeLabels: true };

let currentContainer = null;

function stopNetworkSimulation(container) {
	const simulation = container?.__chive_network_simulation__;
	simulation?.stop?.();
	if (container) container.__chive_network_simulation__ = null;
}

function makeContainer() {
	document.body.innerHTML = '<div id="network"></div>';
	const container = document.getElementById('network');
	Object.defineProperty(container, 'clientWidth', { value: 600, configurable: true });
	currentContainer = container;
	return container;
}

function structure(container) {
	const circles = [...container.querySelectorAll('circle')];
	const lines = [...container.querySelectorAll('line')];
	const labels = [...container.querySelectorAll('.network-labels text')];
	const nodes = circles
		.map((circle, i) => ({ id: labels[i]?.textContent ?? null, fill: circle.getAttribute('fill') }))
		.sort((a, b) => String(a.id).localeCompare(String(b.id)));
	const linkStrokes = lines.map(line => line.getAttribute('stroke')).sort();
	return { nodeCount: circles.length, linkCount: lines.length, nodes, linkStrokes };
}

function render(options, rows = ROWS) {
	const container = makeContainer();
	const result = renderNetworkGraph(container, rows, 'src', 'dst', { ...BASE, ...options });
	return { result, structure: structure(container) };
}

const CASES = {
	'default (no weight/group)': {},
	'with weightColumn + groupColumn': { weightColumn: 'w', groupColumn: 'grp' },
	'uniform edge color': { edgeColorMode: 'uniform' },
};

describe('networkGraph structural equivalence (pure-move guard)', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="network"></div>';
		vi.spyOn(Math, 'random').mockReturnValue(0.42);
	});

	afterEach(() => {
		hideChartTooltip();
		stopNetworkSimulation(currentContainer);
		currentContainer = null;
		document.body.innerHTML = '';
		vi.restoreAllMocks();
	});

	for (const [name, options] of Object.entries(CASES)) {
		it(`is structurally stable: ${name}`, () => {
			const { result, structure: s } = render(options);
			expect(result.ok).toBe(true);
			// 3 nodes (A/B/C deduped) and 4 links (A-B duplicated, links are NOT deduped).
			expect(s.nodeCount).toBe(3);
			expect(s.linkCount).toBe(4);
			expect({ result, structure: s }).toMatchSnapshot();
		});
	}

	it('fails with insufficient-data when no edges resolve', () => {
		const { result, structure: s } = render({}, [{ src: 'A', dst: '' }, { src: '', dst: 'B' }]);
		expect(result).toEqual({ ok: false, reason: 'insufficient-data' });
		expect(s.nodeCount).toBe(0);
		expect(s.linkCount).toBe(0);
	});
});
