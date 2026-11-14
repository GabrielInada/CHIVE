// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { observeWidth } from '../../src/ui/observeWidth.js';

describe('observeWidth', () => {
	let notify;
	let frames;
	let disconnect;
	let element;
	let render;
	let dispose;

	beforeEach(() => {
		frames = new Map();
		let nextId = 0;
		disconnect = vi.fn();
		vi.stubGlobal('ResizeObserver', class {
			constructor(callback) { notify = callback; }
			observe() {}
			disconnect() { disconnect(); }
		});
		vi.stubGlobal('requestAnimationFrame', callback => {
			frames.set(++nextId, callback);
			return nextId;
		});
		vi.stubGlobal('cancelAnimationFrame', id => frames.delete(id));
		element = document.createElement('div');
		Object.defineProperty(element, 'clientWidth', { value: 400 });
		render = vi.fn();
		dispose = observeWidth(element, render);
	});

	afterEach(() => vi.unstubAllGlobals());
	const resize = width => notify([{ contentRect: { width } }]);
	function flush() {
		const callbacks = [...frames.values()];
		frames.clear();
		callbacks.forEach(callback => callback());
	}

	it('coalesces a resize burst and ignores changes that leave width unchanged', () => {
		resize(400);
		flush();
		expect(render).not.toHaveBeenCalled();
		resize(320);
		resize(280);
		flush();
		expect(render).toHaveBeenCalledTimes(1);
		resize(280);
		flush();
		expect(render).toHaveBeenCalledTimes(1);
	});

	it('cancels rendering while hidden and redraws when shown again', () => {
		resize(280);
		resize(0);
		flush();
		expect(render).not.toHaveBeenCalled();
		resize(280);
		flush();
		expect(render).toHaveBeenCalledTimes(1);
	});

	it('disconnects and cancels a pending render on disposal', () => {
		resize(280);
		dispose();
		flush();
		expect(disconnect).toHaveBeenCalledOnce();
		expect(render).not.toHaveBeenCalled();
	});
});
