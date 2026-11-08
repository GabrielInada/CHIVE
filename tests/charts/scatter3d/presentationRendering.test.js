// @vitest-environment jsdom

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import en from '../../../src/i18n/en.json';
import ptBR from '../../../src/i18n/pt-BR.json';
import { CHART_DEFINITIONS } from '../../../src/config/charts/definitions.js';
import { renderScatter3dInto } from '../../../src/charts/scatter3d/presentation.js';
import { clearChartContainer } from '../../../src/charts/shared/containerLifecycle.js';

const runtime = vi.hoisted(() => ({ locale: 'en', render: vi.fn(), dispose: vi.fn(), setSize: vi.fn() }));
const catalogs = { en, 'pt-BR': ptBR };
vi.mock('../../../src/services/i18nService.js', () => ({
	t: (key, ...params) => catalogs[runtime.locale][key].replace(/\$(\d+)/g, (_, n) => String(params[n - 1])),
}));

// Keep the actual scene, geometry and material code; jsdom only lacks the GPU.
vi.mock('../../../vendor/three/three.module.js', async importOriginal => ({
	...await importOriginal(),
	WebGLRenderer: class {
		domElement = document.createElement('canvas');
		setPixelRatio() {}
		setSize = runtime.setSize;
		render = runtime.render;
		dispose = runtime.dispose;
		forceContextLoss() {}
	},
}));

let container;
beforeEach(() => {
	vi.clearAllMocks();
	runtime.locale = 'en';
	document.body.innerHTML = '<div id="chart"></div>';
	container = document.getElementById('chart');
	vi.spyOn(window.HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillText: vi.fn() });
});
afterEach(() => {
	clearChartContainer(container);
	vi.restoreAllMocks();
});

it.each(['en', 'pt-BR'])('renders stored settings and accessible interaction labels in %s', async locale => {
	runtime.locale = locale;
	const config = Object.freeze({
		...CHART_DEFINITIONS.scatter3d.createDefaultConfig(),
		x: 'east', y: 'north', z: 'height',
		pointSize: 0.09, opacity: 0.4, color: '#123456', chartHeight: 300, customTitle: 'Terrain',
	});
	renderScatter3dInto(container, {
		config,
		rows: [{ east: 1, north: 2, height: 3 }, { east: 4, north: 5, height: 6 }],
	});
	await vi.dynamicImportSettled();
	expect(runtime.render).toHaveBeenCalled();
	const [scene] = runtime.render.mock.calls[0];
	const points = scene.children.find(child => child.isPoints);
	expect(points.geometry.getAttribute('position').count).toBe(2);
	expect(points.material.size).toBe(0.09);
	expect(points.material.opacity).toBe(0.4);
	expect(points.material.color.getHexString()).toBe('123456');
	expect(runtime.setSize).toHaveBeenCalledWith(expect.any(Number), 300, false);
	expect(container.querySelector('.chart-canvas-title').textContent).toBe('Terrain');
	const canvas = container.querySelector('.chart-canvas-3d');
	expect(canvas.getAttribute('aria-label')).toBe(catalogs[locale]['chive-chart-scatter3d-aria-label']
		.replace('$1', 'east').replace('$2', 'north').replace('$3', 'height').replace('$4', '2'));
	expect(document.getElementById(canvas.getAttribute('aria-describedby')).textContent)
		.toBe(catalogs[locale]['chive-chart-scatter3d-controls-instructions']);
	canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
	expect(container.querySelector('[role="status"]').textContent)
		.toBe(catalogs[locale]['chive-chart-scatter3d-context-lost']);
	canvas.dispatchEvent(new Event('webglcontextrestored'));
	expect(container.querySelector('[role="status"]').textContent)
		.toBe(catalogs[locale]['chive-chart-scatter3d-context-restored']);
	clearChartContainer(container);
	expect(runtime.dispose).toHaveBeenCalledOnce();
});
