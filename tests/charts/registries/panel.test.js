// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';

const renderers = vi.hoisted(() => ({
	renderBarPanelChart: vi.fn(() => ({ ok: true })),
	renderBubblePanelChart: vi.fn(() => ({ ok: true })),
	renderLinePanelChart: vi.fn(() => ({ ok: true })),
	renderNetworkPanelChart: vi.fn(() => ({ ok: true })),
	renderPiePanelChart: vi.fn(() => ({ ok: true })),
	renderScatterPanelChart: vi.fn(() => ({ ok: true })),
	renderTreemapPanelChart: vi.fn(() => ({ ok: true })),
	renderTinPanelChart: vi.fn(() => ({ ok: true })),
	renderScatter3dPanelChart: vi.fn(() => ({ ok: true })),
}));

vi.mock('../../../src/charts/bar/panelAdapter.js', () => ({ renderBarPanelChart: renderers.renderBarPanelChart }));
vi.mock('../../../src/charts/bubble/panelAdapter.js', () => ({ renderBubblePanelChart: renderers.renderBubblePanelChart }));
vi.mock('../../../src/charts/line/panelAdapter.js', () => ({ renderLinePanelChart: renderers.renderLinePanelChart }));
vi.mock('../../../src/charts/network/panelAdapter.js', () => ({ renderNetworkPanelChart: renderers.renderNetworkPanelChart }));
vi.mock('../../../src/charts/pie/panelAdapter.js', () => ({ renderPiePanelChart: renderers.renderPiePanelChart }));
vi.mock('../../../src/charts/scatter/panelAdapter.js', () => ({ renderScatterPanelChart: renderers.renderScatterPanelChart }));
vi.mock('../../../src/charts/tin/panelAdapter.js', () => ({ renderTinPanelChart: renderers.renderTinPanelChart }));
vi.mock('../../../src/charts/treemap/panelAdapter.js', () => ({ renderTreemapPanelChart: renderers.renderTreemapPanelChart }));
vi.mock('../../../src/charts/scatter3d/panelAdapter.js', () => ({ renderScatter3dPanelChart: renderers.renderScatter3dPanelChart }));
import { getPanelChartRenderer, SUPPORTED_PANEL_CHART_TYPES } from '../../../src/charts/registries/panel.js';
import { renderChartFromSpec } from '../../../src/modules/panelSubsystem/renderChartFromSpec.js';

const baseRows = [{ a: 1 }, { a: 2 }];
const baseColumns = [
	{ name: 'a', type: 'number' },
	{ name: 'b', type: 'text' },
];

function makeSpec(type, configOverrides = {}) {
	return {
		id: 1,
		name: 'Test',
		type,
		config: configOverrides,
		dataSnapshot: baseRows,
		columnsSnapshot: baseColumns,
	};
}

describe('panel chart registry and render bridge', () => {
	let container;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		Object.values(renderers).forEach(fn => fn.mockClear());
	});

	it('exposes the supported renderer types', () => {
		expect(SUPPORTED_PANEL_CHART_TYPES).toEqual(['bar', 'line', 'scatter', 'scatter3d', 'pie', 'bubble', 'network', 'treemap', 'tin']);
	});

	it('returns null from the registry for unknown and inherited keys', () => {
		expect(getPanelChartRenderer('sankey')).toBeNull();
		expect(getPanelChartRenderer('__proto__')).toBeNull();
	});

	it('dispatches scatter3d to the package panel adapter with the whole spec', () => {
		const spec = makeSpec('scatter3d', { x: 'a', y: 'b', z: 'a' });
		renderChartFromSpec(container, spec);
		expect(renderers.renderScatter3dPanelChart).toHaveBeenCalledTimes(1);
		expect(renderers.renderScatter3dPanelChart).toHaveBeenCalledWith(container, spec);
	});

	it('returns invalid-args when container or spec is missing', () => {
		expect(renderChartFromSpec(null, makeSpec('bar')).ok).toBe(false);
		expect(renderChartFromSpec(container, null).ok).toBe(false);
	});

	it('returns unknown-type for unsupported chart types', () => {
		const result = renderChartFromSpec(container, makeSpec('sankey'));
		expect(result.ok).toBe(false);
		expect(result.reason).toBe('unknown-type');
	});

	it('dispatches bar to the package panel adapter with the whole spec', () => {
		const spec = makeSpec('bar', { category: 'a' });
		renderChartFromSpec(container, spec);
		expect(renderers.renderBarPanelChart).toHaveBeenCalledTimes(1);
		expect(renderers.renderBarPanelChart).toHaveBeenCalledWith(container, spec);
	});

	it('dispatches scatter to the package panel adapter with the whole spec', () => {
		const spec = makeSpec('scatter', { x: 'a', y: 'b' });
		renderChartFromSpec(container, spec);
		expect(renderers.renderScatterPanelChart).toHaveBeenCalledTimes(1);
		expect(renderers.renderScatterPanelChart).toHaveBeenCalledWith(container, spec);
	});

	it('dispatches network to the package panel adapter with the whole spec', () => {
		const spec = makeSpec('network', { source: 'src', target: 'tgt', weight: 'w' });
		renderChartFromSpec(container, spec);
		expect(renderers.renderNetworkPanelChart).toHaveBeenCalledTimes(1);
		expect(renderers.renderNetworkPanelChart).toHaveBeenCalledWith(container, spec);
	});

	it('dispatches pie to the package panel adapter with the whole spec', () => {
		const spec = makeSpec('pie', { category: 'a', measureMode: 'sum', valueColumn: 'a' });
		renderChartFromSpec(container, spec);
		expect(renderers.renderPiePanelChart).toHaveBeenCalledTimes(1);
		expect(renderers.renderPiePanelChart).toHaveBeenCalledWith(container, spec);
	});

	it('dispatches bubble to the package panel adapter with the whole spec', () => {
		const spec = makeSpec('bubble', { category: 'a', measureMode: 'bogus' });
		renderChartFromSpec(container, spec);
		expect(renderers.renderBubblePanelChart).toHaveBeenCalledTimes(1);
		expect(renderers.renderBubblePanelChart).toHaveBeenCalledWith(container, spec);
	});

	it('dispatches treemap to the package panel adapter with the whole spec', () => {
		const spec = makeSpec('treemap', { category: 'a', topN: 5 });
		renderChartFromSpec(container, spec);
		expect(renderers.renderTreemapPanelChart).toHaveBeenCalledTimes(1);
		expect(renderers.renderTreemapPanelChart).toHaveBeenCalledWith(container, spec);
	});

	it('dispatches line to the package panel adapter with the whole spec', () => {
		const spec = makeSpec('line', { x: 'a', y: 'a', curve: 'monotone', missingMode: 'gap' });
		renderChartFromSpec(container, spec);
		expect(renderers.renderLinePanelChart).toHaveBeenCalledTimes(1);
		expect(renderers.renderLinePanelChart).toHaveBeenCalledWith(container, spec);
	});

	it('dispatches tin to the package panel adapter with the whole spec', () => {
		const spec = makeSpec('tin', { x: 'a', y: 'b', z: 'a' });
		renderChartFromSpec(container, spec);
		expect(renderers.renderTinPanelChart).toHaveBeenCalledTimes(1);
		expect(renderers.renderTinPanelChart).toHaveBeenCalledWith(container, spec);
	});

	it('accepts chart specs without config objects', () => {
		for (const type of SUPPORTED_PANEL_CHART_TYPES) {
			const spec = makeSpec(type);
			delete spec.config;
			expect(renderChartFromSpec(container, spec).ok).toBe(true);
		}

		expect(renderers.renderBarPanelChart).toHaveBeenCalled();
		expect(renderers.renderScatterPanelChart).toHaveBeenCalled();
		expect(renderers.renderNetworkPanelChart).toHaveBeenCalled();
		expect(renderers.renderPiePanelChart).toHaveBeenCalled();
		expect(renderers.renderBubblePanelChart).toHaveBeenCalled();
		expect(renderers.renderTreemapPanelChart).toHaveBeenCalled();
		expect(renderers.renderLinePanelChart).toHaveBeenCalled();
		expect(renderers.renderTinPanelChart).toHaveBeenCalled();
	});

	it('returns renderer failure results unchanged', () => {
		renderers.renderLinePanelChart.mockReturnValueOnce({ ok: false, reason: 'renderer-failed' });

		const result = renderChartFromSpec(container, makeSpec('line', { x: 'a', y: 'a' }));

		expect(result).toEqual({ ok: false, reason: 'renderer-failed' });
	});

});
