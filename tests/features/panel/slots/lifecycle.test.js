// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const dispatch = vi.hoisted(() => ({
	renderChartSnapshot: vi.fn(() => ({ ok: true })),
}));

vi.mock('../../../../src/features/panel/slots/renderChartSnapshot.js', () => dispatch);

const tooltipMock = vi.hoisted(() => ({
	hideChartTooltip: vi.fn(),
}));

vi.mock('../../../../src/charts/shared/tooltip/tooltip.js', () => tooltipMock);

import { mountSlot, teardownSlot, teardownAllSlots, renderAllSlots } from '../../../../src/features/panel/slots/lifecycle.js';
import { CHART_DISPOSE_HOOK } from '../../../../src/charts/shared/containerLifecycle.js';

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

class FakeIntersectionObserver {
	static instances = [];
	constructor(cb) {
		this.cb = cb;
		this.disconnect = vi.fn();
		FakeIntersectionObserver.instances.push(this);
	}
	observe(target) { this.target = target; }
	trigger(isIntersecting) { this.cb([{ target: this.target, isIntersecting }]); }
}

function sizedContainer(width = 400, height = 300) {
	const container = document.createElement('div');
	container.className = 'panel-chart-container';
	Object.defineProperties(container, {
		clientWidth: { value: width, writable: true },
		clientHeight: { value: height, writable: true },
	});
	return container;
}

describe('panel slot lifecycle', () => {
	let originalRO;
	let originalRAF;
	let originalCAF;
	let frames;
	const flushFrames = () => {
		const callbacks = [...frames.values()];
		frames.clear();
		callbacks.forEach(cb => cb());
	};

	beforeEach(() => {
		originalRO = globalThis.ResizeObserver;
		originalRAF = window.requestAnimationFrame;
		originalCAF = window.cancelAnimationFrame;
		FakeResizeObserver.instances = [];
		globalThis.ResizeObserver = FakeResizeObserver;
		frames = new Map();
		let nextFrame = 0;
		window.requestAnimationFrame = cb => { frames.set(++nextFrame, cb); return nextFrame; };
		window.cancelAnimationFrame = vi.fn(id => frames.delete(id));
		FakeIntersectionObserver.instances = [];
		dispatch.renderChartSnapshot.mockClear();
		tooltipMock.hideChartTooltip.mockClear();
	});

	afterEach(() => {
		globalThis.ResizeObserver = originalRO;
		window.requestAnimationFrame = originalRAF;
		window.cancelAnimationFrame = originalCAF;
		vi.unstubAllGlobals();
	});

	it('mountSlot renders the chart and attaches a ResizeObserver', () => {
		const container = document.createElement('div');
		const snapshot = { id: 1, type: 'bar', config: {}, dataSnapshot: [], columnsSnapshot: [] };

		mountSlot(container, snapshot);

		expect(dispatch.renderChartSnapshot).toHaveBeenCalledWith(container, snapshot);
		expect(FakeResizeObserver.instances).toHaveLength(1);
		expect(FakeResizeObserver.instances[0].observed).toContain(container);
	});

	it('teardownSlot disconnects the observer, stops the network simulation, and clears innerHTML', () => {
		const container = document.createElement('div');
		const stop = vi.fn();
		container[SIMULATION_KEY] = { stop };
		const snapshot = { id: 1, type: 'network', config: {}, dataSnapshot: [], columnsSnapshot: [] };

		mountSlot(container, snapshot);
		container.innerHTML = '<svg></svg>';

		const observer = FakeResizeObserver.instances[0];
		teardownSlot(container);

		expect(observer.disconnected).toBe(true);
		expect(stop).toHaveBeenCalled();
		expect(container[SIMULATION_KEY]).toBeNull();
		expect(container.innerHTML).toBe('');
	});

	it('teardownSlot clears any active tooltip so a mid-pin teardown does not orphan listeners', () => {
		const container = document.createElement('div');
		mountSlot(container, { id: 1, type: 'bar', config: {}, dataSnapshot: [], columnsSnapshot: [] });

		teardownSlot(container);

		expect(tooltipMock.hideChartTooltip).toHaveBeenCalled();
	});

	it('teardownAllSlots cleans every panel-chart-container under root', () => {
		const root = document.createElement('div');
		const a = document.createElement('div');
		a.className = 'panel-chart-container';
		const b = document.createElement('div');
		b.className = 'panel-chart-container';
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

	it('the resize callback re-invokes the dispatcher with the original snapshot', () => {
		const container = sizedContainer();
		const snapshot = { id: 1, type: 'bar', config: {}, dataSnapshot: [], columnsSnapshot: [] };

		mountSlot(container, snapshot);
		dispatch.renderChartSnapshot.mockClear();

		container.clientWidth = 500;
		FakeResizeObserver.instances[0].trigger();
		flushFrames();

		expect(dispatch.renderChartSnapshot).toHaveBeenCalledWith(container, snapshot);
	});

	it('teardownSlot runs a stashed chart dispose hook and removes it', () => {
		const container = document.createElement('div');
		mountSlot(container, { id: 1, type: 'bar', config: {}, dataSnapshot: [], columnsSnapshot: [] });
		const dispose = vi.fn();
		container[CHART_DISPOSE_HOOK] = dispose;
		container.innerHTML = '<canvas></canvas>';

		teardownSlot(container);

		expect(dispose).toHaveBeenCalledTimes(1);
		expect(container[CHART_DISPOSE_HOOK]).toBeUndefined();
		expect(container.innerHTML).toBe('');
	});

	it('the resize re-render runs the dispose hook before the replacement render', () => {
		const container = sizedContainer();
		const snapshot = { id: 1, type: 'bar', config: {}, dataSnapshot: [], columnsSnapshot: [] };
		mountSlot(container, snapshot);
		dispatch.renderChartSnapshot.mockClear();

		const callOrder = [];
		container[CHART_DISPOSE_HOOK] = vi.fn(() => callOrder.push('dispose'));
		dispatch.renderChartSnapshot.mockImplementationOnce(() => {
			callOrder.push('render');
			return { ok: true };
		});

		container.clientHeight = 400;
		FakeResizeObserver.instances[0].trigger();
		flushFrames();

		expect(callOrder).toEqual(['dispose', 'render']);
		expect(container[CHART_DISPOSE_HOOK]).toBeUndefined();
	});

	it('mountSlot tearing down a previous mount before re-mounting (replace flow)', () => {
		const container = document.createElement('div');
		const snapshot1 = { id: 1, type: 'bar' };
		const snapshot2 = { id: 2, type: 'pie' };

		mountSlot(container, snapshot1);
		const firstObserver = FakeResizeObserver.instances[0];

		mountSlot(container, snapshot2);

		expect(firstObserver.disconnected).toBe(true);
		expect(FakeResizeObserver.instances).toHaveLength(2);
		expect(dispatch.renderChartSnapshot).toHaveBeenLastCalledWith(container, snapshot2);
	});

	it('ignores the initial/unchanged resize and coalesces real changes into one render', () => {
		const container = sizedContainer();
		mountSlot(container, { id: 1, type: 'line' });
		const observer = FakeResizeObserver.instances[0];
		observer.trigger();
		flushFrames();
		expect(dispatch.renderChartSnapshot).toHaveBeenCalledTimes(1);
		container.clientWidth = 500;
		observer.trigger();
		container.clientHeight = 350;
		observer.trigger();
		expect(frames.size).toBe(1);
		flushFrames();
		expect(dispatch.renderChartSnapshot).toHaveBeenCalledTimes(2);
		observer.trigger();
		flushFrames();
		expect(dispatch.renderChartSnapshot).toHaveBeenCalledTimes(2);
	});

	it('keeps the current chart when a queued resize becomes hidden', () => {
		const container = sizedContainer();
		mountSlot(container, { id: 1, type: 'line' });
		const observer = FakeResizeObserver.instances[0];
		container.clientWidth = 500;
		observer.trigger();
		container.clientWidth = 0;
		observer.trigger();
		flushFrames();
		expect(dispatch.renderChartSnapshot).toHaveBeenCalledTimes(1);
		container.clientWidth = 500;
		observer.trigger();
		flushFrames();
		expect(dispatch.renderChartSnapshot).toHaveBeenCalledTimes(2);
	});

	it('renders deferred slots on approach and applies an offscreen resize on return', () => {
		vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
		const container = sizedContainer();
		const snapshot = Object.freeze({ id: 1, type: 'line', config: Object.freeze({ chartHeight: 320 }) });
		mountSlot(container, snapshot, { deferUntilVisible: true });
		const visibility = FakeIntersectionObserver.instances[0];
		const resize = FakeResizeObserver.instances[0];
		resize.trigger();
		visibility.trigger(false);
		flushFrames();
		expect(dispatch.renderChartSnapshot).not.toHaveBeenCalled();
		visibility.trigger(true);
		flushFrames();
		resize.trigger();
		flushFrames();
		expect(dispatch.renderChartSnapshot).toHaveBeenCalledTimes(1);
		visibility.trigger(false);
		container.clientWidth = 600;
		resize.trigger();
		flushFrames();
		expect(dispatch.renderChartSnapshot).toHaveBeenCalledTimes(1);
		visibility.trigger(true);
		flushFrames();
		expect(dispatch.renderChartSnapshot).toHaveBeenCalledTimes(2);
		expect(dispatch.renderChartSnapshot).toHaveBeenLastCalledWith(container, snapshot);
		expect(snapshot.config.chartHeight).toBe(320);
	});

	it('cancels deferred work on teardown and ignores callbacks from an old mount', () => {
		vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
		const container = sizedContainer();
		mountSlot(container, { id: 1, type: 'line' }, { deferUntilVisible: true });
		const visibility = FakeIntersectionObserver.instances[0];
		visibility.trigger(true);
		teardownSlot(container);
		flushFrames();
		expect(visibility.disconnect).toHaveBeenCalledOnce();
		expect(dispatch.renderChartSnapshot).not.toHaveBeenCalled();
		mountSlot(container, { id: 2, type: 'line' });
		visibility.trigger(true);
		FakeResizeObserver.instances[0].trigger();
		flushFrames();
		expect(dispatch.renderChartSnapshot).toHaveBeenCalledTimes(1);
	});

	it('materializes deferred slots for export without duplicating a queued render', () => {
		vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
		const root = document.createElement('div');
		const a = sizedContainer();
		const b = sizedContainer();
		root.append(a, b);
		mountSlot(a, { id: 1, type: 'line' }, { deferUntilVisible: true });
		mountSlot(b, { id: 2, type: 'bar' }, { deferUntilVisible: true });
		FakeIntersectionObserver.instances[0].trigger(true);
		renderAllSlots(root);
		flushFrames();
		expect(dispatch.renderChartSnapshot).toHaveBeenCalledTimes(2);
		renderAllSlots(root);
		expect(dispatch.renderChartSnapshot).toHaveBeenCalledTimes(2);
	});

	it('falls back to eager rendering without IntersectionObserver', () => {
		vi.stubGlobal('IntersectionObserver', undefined);
		const container = sizedContainer();
		expect(mountSlot(container, { id: 1, type: 'line' }, { deferUntilVisible: true })).toEqual({ ok: true });
		expect(dispatch.renderChartSnapshot).toHaveBeenCalledTimes(1);
	});
});
