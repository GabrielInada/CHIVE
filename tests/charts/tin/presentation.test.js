// @vitest-environment jsdom

/**
 * The presentation flow is the one place that reads the browser-local TIN
 * color-rendering setting. It reads it on every render, for Visualizations and
 * Panel alike, and the renderer draws the surface in that mode.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHART_DEFINITIONS } from '../../../src/config/charts/definitions.js';
import { setTinColorRendering } from '../../../src/services/settingsService.js';
import { getPanelChartRenderer } from '../../../src/charts/registries/panel.js';
import { renderTinInto } from '../../../src/charts/tin/presentation.js';

vi.mock('../../../src/services/i18nService.js', () => ({
	t: key => key,
	getLocale: () => 'en',
}));

const rows = [
	{ x: 0, y: 0, z: 0 },
	{ x: 10, y: 0, z: 5 },
	{ x: 0, y: 10, z: 10 },
	{ x: 10, y: 10, z: 20 },
	{ x: 5, y: 5, z: 7 },
];
const config = { ...CHART_DEFINITIONS.tin.createDefaultConfig(), x: 'x', y: 'y', z: 'z' };

function mount() {
	const container = document.createElement('div');
	document.body.append(container);
	return container;
}

function surfaceFills(container) {
	return [...container.querySelectorAll('path[fill]')]
		.map(path => path.getAttribute('fill'))
		.filter(fill => fill !== 'none');
}

afterEach(() => {
	setTinColorRendering('optimized');
	document.body.replaceChildren();
});

describe('TIN presentation color rendering', () => {
	it('draws in the mode the setting holds, read again on every render', () => {
		const container = mount();
		setTinColorRendering('optimized');
		renderTinInto(container, { rows, config });
		const optimized = surfaceFills(container);

		setTinColorRendering('full-ramp');
		renderTinInto(container, { rows, config });

		expect(optimized.length).toBeGreaterThan(0);
		expect(surfaceFills(container)).not.toEqual(optimized);
	});

	it('draws Panel captures in the same mode', () => {
		setTinColorRendering('full-ramp');
		const visualizations = mount();
		renderTinInto(visualizations, { rows, config });
		const panel = mount();

		getPanelChartRenderer('tin')(panel, { type: 'tin', config, dataSnapshot: rows, columnsSnapshot: [] });

		expect(surfaceFills(panel)).toEqual(surfaceFills(visualizations));
	});
});
