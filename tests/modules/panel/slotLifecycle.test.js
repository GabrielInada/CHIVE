// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const dispatch = vi.hoisted(() => ({
	renderChartFromSpec: vi.fn(() => ({ ok: true })),
	SUPPORTED_PANEL_CHART_TYPES: ['bar', 'scatter', 'network', 'pie', 'bubble', 'treemap'],
}));

vi.mock('../../../src/modules/panel/renderChartFromSpec.js', () => dispatch);

import { mountSlot, teardownSlot, teardownAllSlots } from '../../../src/modules/panel/slotLifecycle.js';

const SIMULATION_KEY = '__chive_network_simulation__';

class FakeResizeObserver {
	constructor(cb) {
		this.cb = cb;
		this.observed = [];
		this.disconnected = false;
		FakeResizeObserver.instances.push(this);
	}
	observe(el) { this.observed.push(el); }
	disconnect() { this.disconnected = true; }
	trigger() { this.cb([{ target: this.observed[0] }], this); }
}
FakeResizeObserver.instances = [];

describe('slotLifecycle', () => {
	let originalRO;
	let originalRAF;
	let originalCAF;

	beforeEach(() => {
		originalRO = globalThis.ResizeObserver;
		originalRAF = window.requestAnimationFrame;
		originalCAF = window.cancelAnimationFrame;
		FakeResizeObserver.instances = [];
		globalThis.ResizeObserver = FakeResizeObserver;
		window.requestAnimationFrame = (cb) => { cb(); return 1; };
		window.cancelAnimationFrame = vi.fn();
		dispatch.renderChartFromSpec.mockClear();
	});

	afterEach(() => {
		globalThis.ResizeObserver = originalRO;
		window.requestAnimationFrame = originalRAF;
		window.cancelAnimationFrame = originalCAF;
	});

	it('mountSlot renders the chart and attaches a ResizeObserver', () => {
		const container = document.createElement('div');
		const spec = { id: 1, type: 'bar', config: {}, dataSnapshot: [], columnsSnapshot: [] };

		mountSlot(container, spec);

		expect(dispatch.renderChartFromSpec).toHaveBeenCalledWith(container, spec);
		expect(FakeResizeObserver.instances).toHaveLength(1);
		expect(FakeResizeObserver.instances[0].observed).toContain(container);
	});

	it('teardownSlot disconnects the observer, stops the network simulation, and clears innerHTML', () => {
		const container = document.createElement('div');
		const stop = vi.fn();
		container[SIMULATION_KEY] = { stop };
		const spec = { id: 1, type: 'network', config: {}, dataSnapshot: [], columnsSnapshot: [] };

		mountSlot(container, spec);
		container.innerHTML = '<svg></svg>';

		const observer = FakeResizeObserver.instances[0];
		teardownSlot(container);

		expect(observer.disconnected).toBe(true);
		expect(stop).toHaveBeenCalled();
		expect(container[SIMULATION_KEY]).toBeNull();
		expect(container.innerHTML).toBe('');
	});

	it('teardownAllSlots cleans every painel-slot-svg under root', () => {
		const root = document.createElement('div');
		const a = document.createElement('div');
		a.className = 'painel-slot-svg';
		const b = document.createElement('div');
		b.className = 'painel-slot-svg';
		root.appendChild(a);
		root.appendChild(b);

		const stopA = vi.fn();
		const stopB = vi.fn();
		a[SIMULATION_KEY] = { stop: stopA };
		b[SIMULATION_KEY] = { stop: stopB };
		mountSlot(a, { id: 1, type: 'bar' });
		mountSlot(b, { id: 2, type: 'bar' });

		teardownAllSlots(root);

		expect(stopA).toHaveBeenCalled();
		expect(stopB).toHaveBeenCalled();
		expect(FakeResizeObserver.instances.every(o => o.disconnected)).toBe(true);
	});

	it('the resize callback re-invokes the dispatcher with the original spec', () => {
		const container = document.createElement('div');
		const spec = { id: 1, type: 'bar', config: {}, dataSnapshot: [], columnsSnapshot: [] };

		mountSlot(container, spec);
		dispatch.renderChartFromSpec.mockClear();

		FakeResizeObserver.instances[0].trigger();

		expect(dispatch.renderChartFromSpec).toHaveBeenCalledWith(container, spec);
	});

	it('mountSlot tearing down a previous mount before re-mounting (replace flow)', () => {
		const container = document.createElement('div');
		const spec1 = { id: 1, type: 'bar' };
		const spec2 = { id: 2, type: 'pie' };

		mountSlot(container, spec1);
		const firstObserver = FakeResizeObserver.instances[0];

		mountSlot(container, spec2);

		expect(firstObserver.disconnected).toBe(true);
		expect(FakeResizeObserver.instances).toHaveLength(2);
		expect(dispatch.renderChartFromSpec).toHaveBeenLastCalledWith(container, spec2);
	});
});
