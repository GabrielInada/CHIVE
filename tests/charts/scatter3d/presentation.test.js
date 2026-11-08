// @vitest-environment jsdom

/**
 * The 3D scatter's presentation flow loads the WebGL renderer on first use and
 * shows a loading message meanwhile; then it labels the canvas, notes sampling
 * or shows the empty-state message. The renderer module is replaced, since
 * jsdom has no WebGL.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../src/i18n/en.json';
import ptBR from '../../../src/i18n/pt-BR.json';
import { CHART_DEFINITIONS } from '../../../src/config/charts/definitions.js';
import { clearChartContainer } from '../../../src/charts/shared/containerLifecycle.js';
import { renderScatter3dInto } from '../../../src/charts/scatter3d/presentation.js';

const locale = vi.hoisted(() => ({ value: 'en' }));
const three = vi.hoisted(() => ({ renderScatter3dChart: vi.fn() }));
const catalogs = { en, 'pt-BR': ptBR };

vi.mock('../../../src/services/i18nService.js', () => ({
	t: (key, ...params) => (catalogs[locale.value][key] ?? key).replace(/\$(\d+)/g, (_, n) => String(params[n - 1])),
	getLocale: () => locale.value,
}));
vi.mock('../../../src/charts/scatter3d/renderers/three.js', () => three);

const rows = [{ a: 1, b: 2, c: 3 }, { a: 2, b: 3, c: 4 }];
const config = { ...CHART_DEFINITIONS.scatter3d.createDefaultConfig(), x: 'a', y: 'b', z: 'c' };

// Like the WebGL renderer: empty the container through the dispose contract, then draw.
function drawCanvas(payload = {}) {
	return container => {
		clearChartContainer(container);
		const canvas = document.createElement('canvas');
		canvas.className = 'chart-canvas-3d';
		container.append(canvas);
		return { ok: true, renderedCount: 2, validCount: 2, totalCount: 2, truncated: false, ...payload };
	};
}

function mount() {
	const container = document.createElement('div');
	document.body.append(container);
	return container;
}

async function rendered(calls = 1) {
	await vi.waitFor(() => expect(three.renderScatter3dChart).toHaveBeenCalledTimes(calls));
}

beforeEach(() => {
	locale.value = 'en';
	document.body.replaceChildren();
	three.renderScatter3dChart.mockReset();
	three.renderScatter3dChart.mockImplementation(drawCanvas());
});

describe('3D scatter presentation', () => {
	it('shows a loading message until the renderer draws, then labels the canvas', async () => {
		const container = mount();

		const result = renderScatter3dInto(container, { rows, config });

		expect(result).toEqual({ ok: true, pending: true });
		expect(container.querySelector('.chart-loading').textContent).toBe('Loading the 3D renderer…');
		await rendered();
		expect(container.querySelector('.chart-loading')).toBeNull();
		expect(container.querySelector('.chart-canvas-3d').getAttribute('aria-label'))
			.toBe('3D scatter of a (X), b (Y) and c (Z), 2 points. Interactive: rotate and zoom with the keyboard or pointer.');
	});

	it('hands the renderer the rows, the columns and its localized labels', async () => {
		locale.value = 'pt-BR';

		renderScatter3dInto(mount(), { rows, config });
		await rendered();

		const [, calledRows, calledConfig, context] = three.renderScatter3dChart.mock.calls[0];
		expect(calledRows).toBe(rows);
		expect(calledConfig).toBe(config);
		expect(context.labels).toEqual({
			controlsInstructions: ptBR['chive-chart-scatter3d-controls-instructions'],
			contextLost: ptBR['chive-chart-scatter3d-context-lost'],
			contextRestored: ptBR['chive-chart-scatter3d-context-restored'],
		});
	});

	it('notes sampling only when the renderer reports it', async () => {
		const sampled = mount();
		three.renderScatter3dChart.mockImplementation(drawCanvas({ truncated: true, renderedCount: 10, validCount: 99 }));
		renderScatter3dInto(sampled, { rows, config });
		await rendered();
		expect(sampled.querySelector('.chart-sampling-notice').textContent).toBe('Showing 10 of 99 points.');

		const full = mount();
		three.renderScatter3dChart.mockImplementation(drawCanvas());
		renderScatter3dInto(full, { rows, config });
		await rendered(2);
		expect(full.querySelector('.chart-sampling-notice')).toBeNull();
	});

	it.each([
		['no-valid-points', 'chive-chart-empty-scatter3d-no-valid-points'],
		['webgl-unavailable', 'chive-chart-empty-scatter3d-webgl-unavailable'],
		['render-error', 'chive-chart-empty-scatter3d'],
		[undefined, 'chive-chart-empty-scatter3d'],
	])('shows the message for a %s failure', async (reason, key) => {
		three.renderScatter3dChart.mockReturnValue(reason ? { ok: false, reason } : { ok: false });
		const container = mount();

		renderScatter3dInto(container, { rows, config });
		await rendered();

		expect(container.querySelector('.chart-empty').textContent).toBe(en[key]);
	});

	it('a newer render replaces one still loading', async () => {
		const container = mount();
		const newerRows = [{ a: 5, b: 6, c: 7 }];

		renderScatter3dInto(container, { rows, config });
		renderScatter3dInto(container, { rows: newerRows, config });
		await rendered();
		await new Promise(resolve => setTimeout(resolve, 0));

		expect(three.renderScatter3dChart).toHaveBeenCalledTimes(1);
		expect(three.renderScatter3dChart.mock.calls[0][1]).toBe(newerRows);
	});

	it('clearing the container while the renderer loads cancels the render', async () => {
		renderScatter3dInto(mount(), { rows, config });
		await rendered();
		const container = mount();

		renderScatter3dInto(container, { rows, config });
		clearChartContainer(container);
		await new Promise(resolve => setTimeout(resolve, 0));

		expect(three.renderScatter3dChart).toHaveBeenCalledTimes(1);
		expect(container.childElementCount).toBe(0);
	});
});
