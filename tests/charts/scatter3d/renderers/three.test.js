// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Lightweight fakes for the vendored three module: jsdom has no WebGL, so
// the renderer contract (DOM, sizing calls, Result shape, dispose hook) is
// asserted against spies. The path resolves to the same vendor file the
// renderer imports.
const three = vi.hoisted(() => {
	class FakeWebGLRenderer {
		constructor() {
			if (FakeWebGLRenderer.failNext) {
				FakeWebGLRenderer.failNext = false;
				throw new Error('no webgl');
			}
			this.domElement = document.createElement('canvas');
			this.setPixelRatio = vi.fn();
			this.setSize = vi.fn();
			this.render = vi.fn();
			this.dispose = vi.fn();
			this.forceContextLoss = vi.fn();
			FakeWebGLRenderer.instances.push(this);
		}
	}
	FakeWebGLRenderer.instances = [];
	FakeWebGLRenderer.failNext = false;

	class FakeBufferGeometry {
		constructor() {
			this.setAttribute = vi.fn();
			this.dispose = vi.fn();
			FakeBufferGeometry.instances.push(this);
		}
	}
	FakeBufferGeometry.instances = [];

	class FakePointsMaterial {
		constructor() {
			if (FakePointsMaterial.failNext) {
				FakePointsMaterial.failNext = false;
				throw new Error('material boom');
			}
			this.dispose = vi.fn();
			FakePointsMaterial.instances.push(this);
		}
	}
	FakePointsMaterial.instances = [];
	FakePointsMaterial.failNext = false;

	class FakeDisposable {
		constructor() {
			this.dispose = vi.fn();
		}
	}

	return {
		FakeWebGLRenderer,
		FakeBufferGeometry,
		FakePointsMaterial,
		module: {
			WebGLRenderer: FakeWebGLRenderer,
			Scene: class { constructor() { this.add = vi.fn(); } },
			PerspectiveCamera: class {
				constructor() {
					this.position = { set: vi.fn() };
					this.lookAt = vi.fn();
				}
			},
			BufferGeometry: FakeBufferGeometry,
			BufferAttribute: class { constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; } },
			PointsMaterial: FakePointsMaterial,
			Points: class { constructor(geometry, material) { this.geometry = geometry; this.material = material; } },
			BoxGeometry: FakeDisposable,
			EdgesGeometry: class extends FakeDisposable { constructor() { super(); } },
			LineBasicMaterial: FakeDisposable,
			LineSegments: class { },
			Color: class { constructor(value) { this.value = value; } },
			CanvasTexture: FakeDisposable,
			SpriteMaterial: FakeDisposable,
			Sprite: class {
				constructor() {
					this.scale = { set: vi.fn() };
					this.position = { set: vi.fn() };
				}
			},
		},
	};
});

vi.mock('../../../../vendor/three/three.module.js', () => three.module);

import { renderScatter3dChart } from '../../../../src/charts/scatter3d/renderers/three.js';
import { CHART_DISPOSE_HOOK } from '../../../../src/utils/chartContainerLifecycle.js';

const rows = [
	{ a: 1, b: 2, c: 3 },
	{ a: 4, b: 5, c: 6 },
	{ a: 7, b: 8, c: 9 },
];

function makeContainer() {
	const container = document.createElement('div');
	container.id = 'chart-scatter3d-container';
	Object.defineProperty(container, 'clientWidth', { value: 640, configurable: true });
	document.body.appendChild(container);
	return container;
}

function render(container, options = {}) {
	return renderScatter3dChart(container, rows, 'a', 'b', 'c', {
		chartHeight: 460,
		labels: {
			ariaLabel: 'label text',
			controlsInstructions: 'controls text',
		},
		...options,
	});
}

describe('renderScatter3dChart', () => {
	let warnSpy;
	let getContextSpy;

	beforeEach(() => {
		document.body.innerHTML = '';
		three.FakeWebGLRenderer.instances = [];
		three.FakeBufferGeometry.instances = [];
		three.FakePointsMaterial.instances = [];
		three.FakeWebGLRenderer.failNext = false;
		three.FakePointsMaterial.failNext = false;
		getContextSpy = vi.spyOn(window.HTMLCanvasElement.prototype, 'getContext').mockImplementation(type => {
			if (type !== '2d') return null;
			return {
				font: '',
				fillStyle: '',
				textAlign: '',
				textBaseline: '',
				fillText: vi.fn(),
			};
		});
		warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => {
		getContextSpy.mockRestore();
		warnSpy.mockRestore();
	});

	it('fails without a container or complete column selection', () => {
		expect(render(null).ok).toBe(false);
		const container = makeContainer();
		expect(renderScatter3dChart(container, rows, 'a', null, 'c', {}).ok).toBe(false);
	});

	it('fails with no-valid-points when no row survives coercion', () => {
		const container = makeContainer();
		const result = renderScatter3dChart(container, [{ a: 'x', b: 'y', c: 'z' }], 'a', 'b', 'c', {});
		expect(result).toEqual({ ok: false, reason: 'no-valid-points' });
	});

	it('fails with webgl-unavailable when the renderer constructor throws', () => {
		three.FakeWebGLRenderer.failNext = true;
		const result = render(makeContainer());
		expect(result).toEqual({ ok: false, reason: 'webgl-unavailable' });
	});

	it('renders ok: canvas in the DOM, a11y wiring, sizing calls, counts payload', () => {
		const container = makeContainer();
		const result = render(container);

		expect(result.ok).toBe(true);
		expect(result).toMatchObject({ renderedCount: 3, validCount: 3, totalCount: 3, truncated: false });

		const canvas = container.querySelector('canvas.chart-canvas-3d');
		expect(canvas).not.toBeNull();
		expect(canvas.getAttribute('tabindex')).toBe('0');
		expect(canvas.getAttribute('role')).toBe('img');
		expect(canvas.getAttribute('aria-label')).toBe('label text');
		expect(canvas.getAttribute('aria-keyshortcuts')).toContain('ArrowLeft');

		const descriptionId = canvas.getAttribute('aria-describedby');
		expect(descriptionId).toBe('chart-scatter3d-container-controls-desc');
		const description = document.getElementById(descriptionId);
		expect(description.classList.contains('visually-hidden')).toBe(true);
		expect(description.textContent).toBe('controls text');

		const renderer = three.FakeWebGLRenderer.instances[0];
		expect(renderer.setPixelRatio).toHaveBeenCalledWith(1);
		expect(renderer.setSize).toHaveBeenCalledWith(640, 460, false);
		expect(renderer.render).toHaveBeenCalled();
	});

	it('renders the custom title as an HTML heading only when set', () => {
		const container = makeContainer();
		render(container, { customTitle: 'Depth view' });
		expect(container.querySelector('.chart-canvas-title')?.textContent).toBe('Depth view');

		render(container, { customTitle: '' });
		expect(container.querySelector('.chart-canvas-title')).toBeNull();
	});

	it('stashes a dispose hook that tears everything down and detaches input', () => {
		const container = makeContainer();
		render(container);

		const renderer = three.FakeWebGLRenderer.instances[0];
		const geometry = three.FakeBufferGeometry.instances[0];
		const material = three.FakePointsMaterial.instances[0];
		const canvas = container.querySelector('canvas');
		const dispose = container[CHART_DISPOSE_HOOK];
		expect(typeof dispose).toBe('function');

		dispose();

		expect(geometry.dispose).toHaveBeenCalled();
		expect(material.dispose).toHaveBeenCalled();
		expect(renderer.dispose).toHaveBeenCalled();
		expect(renderer.forceContextLoss).toHaveBeenCalled();

		// Listeners are gone: further input must not trigger renders.
		const rendersAfterDispose = renderer.render.mock.calls.length;
		canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
		expect(renderer.render.mock.calls.length).toBe(rendersAfterDispose);
	});

	it('re-render runs the previous dispose hook first (context cap guard)', () => {
		const container = makeContainer();
		render(container);
		const firstRenderer = three.FakeWebGLRenderer.instances[0];

		render(container);

		expect(firstRenderer.dispose).toHaveBeenCalled();
		expect(firstRenderer.forceContextLoss).toHaveBeenCalled();
		expect(three.FakeWebGLRenderer.instances).toHaveLength(2);
		expect(container.querySelectorAll('canvas')).toHaveLength(1);
	});

	it('a mid-build throw disposes partial GPU objects and fails with render-error', () => {
		three.FakePointsMaterial.failNext = true;
		const container = makeContainer();

		const result = render(container);

		expect(result).toEqual({ ok: false, reason: 'render-error' });
		expect(warnSpy).toHaveBeenCalled();
		const renderer = three.FakeWebGLRenderer.instances[0];
		const geometry = three.FakeBufferGeometry.instances[0];
		expect(geometry.dispose).toHaveBeenCalled();
		expect(renderer.dispose).toHaveBeenCalled();
		expect(renderer.forceContextLoss).toHaveBeenCalled();
		expect(container[CHART_DISPOSE_HOOK]).toBeUndefined();
	});

	it('keyboard input triggers exactly one render per handled key', () => {
		const container = makeContainer();
		render(container);
		const renderer = three.FakeWebGLRenderer.instances[0];
		const canvas = container.querySelector('canvas');
		const before = renderer.render.mock.calls.length;

		canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
		canvas.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
		canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
		canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));

		expect(renderer.render.mock.calls.length).toBe(before + 3);
	});

	it('wheel and pointer drag input re-render on demand', () => {
		const container = makeContainer();
		render(container);
		const renderer = three.FakeWebGLRenderer.instances[0];
		const canvas = container.querySelector('canvas');
		const before = renderer.render.mock.calls.length;

		canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true }));
		canvas.dispatchEvent(new MouseEvent('pointerdown', { button: 0, clientX: 10, clientY: 10, bubbles: true }));
		canvas.dispatchEvent(new MouseEvent('pointermove', { clientX: 30, clientY: 20, bubbles: true }));
		canvas.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));

		expect(renderer.render.mock.calls.length).toBe(before + 2);
	});
});
