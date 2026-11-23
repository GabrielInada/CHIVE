// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderContext } from '../../renderContext.js';

const mocks = vi.hoisted(() => ({ togglePinnedFilterTooltip: vi.fn() }));

vi.mock('../../../../src/charts/shared/tooltip/filterActions.js', () => ({
	togglePinnedFilterTooltip: mocks.togglePinnedFilterTooltip,
}));

import { renderNetworkGraph } from '../../../../src/charts/network/renderers/svg.js';
import { hideChartTooltip } from '../../../../src/charts/shared/tooltip/tooltip.js';

const SIMULATION_KEY = '__chive_network_simulation__';

function render() {
	const container = document.getElementById('network');
	const result = renderNetworkGraph(container, [
		{ source: 'A', target: 'B' },
		{ source: 'B', target: 'C' },
	], { source: 'source', target: 'target' }, renderContext({ source: 'source', target: 'target' }));
	expect(result.ok).toBe(true);
	return container;
}

function mouse(target, type, init = {}) {
	const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
	// jsdom rejects the test window as a constructor `view`; d3-drag only reads it
	// to choose where to listen for the rest of the gesture.
	Object.defineProperty(event, 'view', { value: window });
	target.dispatchEvent(event);
}

describe('network graph pinning anchor', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="network"></div>';
		mocks.togglePinnedFilterTooltip.mockClear();
	});

	afterEach(() => {
		document.getElementById('network')?.[SIMULATION_KEY]?.stop();
		hideChartTooltip();
	});

	it('anchors at the pointer when the viewport has no screen transform', () => {
		const container = render();
		const node = container.querySelector('.network-node');

		const click = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 7, clientY: 9 });
		node.dispatchEvent(click);

		const [, startX, startY, options] = mocks.togglePinnedFilterTooltip.mock.calls[0];
		expect([startX, startY]).toEqual([click.pageX, click.pageY]);
		expect(click.pageX).toBe(7);
		expect(options.anchor()).toBeNull();
		expect(options.headerTitle).toBe(node.__data__.id);
	});

	it('projects the node through the screen transform when createSVGPoint is missing', () => {
		const container = render();
		const svg = container.querySelector('svg');
		const viewport = svg.querySelector('g');
		viewport.getScreenCTM = () => ({ a: 2, b: 0, c: 0, d: 3, e: 100, f: 50 });
		expect(typeof svg.createSVGPoint).toBe('undefined');
		const node = container.querySelector('.network-node');
		const datum = node.__data__;
		datum.x = 10;
		datum.y = -4;

		mouse(node, 'click');

		const [, startX, startY, options] = mocks.togglePinnedFilterTooltip.mock.calls[0];
		const expected = { x: 2 * 10 + 100 + window.scrollX, y: 3 * -4 + 50 + window.scrollY };
		expect({ x: startX, y: startY }).toEqual(expected);

		datum.x = 20;
		expect(options.anchor()).toEqual({ x: 2 * 20 + 100 + window.scrollX, y: expected.y });
	});

	it('ignores hover and movement over the background', () => {
		const container = render();
		const svg = container.querySelector('svg');

		mouse(svg, 'mouseover');
		mouse(svg, 'mousemove');
		mouse(svg, 'mouseout');

		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip === null || tooltip.hidden).toBe(true);
	});
});

describe('network graph node drag', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="network"></div>';
	});

	afterEach(() => {
		document.getElementById('network')?.[SIMULATION_KEY]?.stop();
	});

	it('pins a node under the pointer while dragged and releases it on drop', () => {
		const container = render();
		const simulation = container[SIMULATION_KEY];
		const node = container.querySelector('.network-node');
		const datum = node.__data__;
		const start = { x: datum.x, y: datum.y };

		mouse(node, 'mousedown', { clientX: 10, clientY: 10, button: 0 });
		expect({ fx: datum.fx, fy: datum.fy }).toEqual({ fx: start.x, fy: start.y });
		expect(simulation.alphaTarget()).toBe(0.3);

		mouse(window, 'mousemove', { clientX: 30, clientY: 40 });
		expect(datum.fx).toBeCloseTo(start.x + 20);
		expect(datum.fy).toBeCloseTo(start.y + 30);

		mouse(window, 'mouseup', { clientX: 30, clientY: 40 });
		expect(datum.fx).toBeNull();
		expect(datum.fy).toBeNull();
		expect(simulation.alphaTarget()).toBe(0);
	});

	it.each([
		['a ctrl-click', { ctrlKey: true, button: 0 }],
		['a secondary button', { button: 2 }],
	])('does not start a drag on %s', (_label, init) => {
		const container = render();
		const datum = container.querySelector('.network-node').__data__;

		mouse(container.querySelector('.network-node'), 'mousedown', { clientX: 10, clientY: 10, ...init });

		expect(datum.fx).toBeUndefined();
		expect(container[SIMULATION_KEY].alphaTarget()).toBe(0);
	});
});
