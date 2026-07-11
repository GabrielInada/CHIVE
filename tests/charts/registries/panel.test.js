// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';

const renderers = vi.hoisted(() => ({
	renderBarPanelChart: vi.fn(() => ({ ok: true })),
	renderBubblePanelChart: vi.fn(() => ({ ok: true })),
	renderLineChart: vi.fn(() => ({ ok: true })),
	renderNetworkGraph: vi.fn(() => ({ ok: true })),
	renderPiePanelChart: vi.fn(() => ({ ok: true })),
	renderScatterPlot: vi.fn(() => ({ ok: true })),
	renderTreemapPanelChart: vi.fn(() => ({ ok: true })),
	renderTinChart: vi.fn(() => ({ ok: true })),
	renderScatter3dPanelChart: vi.fn(() => ({ ok: true })),
}));

vi.mock('../../../src/charts/bar/panelAdapter.js', () => ({ renderBarPanelChart: renderers.renderBarPanelChart }));
vi.mock('../../../src/charts/bubble/panelAdapter.js', () => ({ renderBubblePanelChart: renderers.renderBubblePanelChart }));
vi.mock('../../../src/modules/visualizations/lineChart.js', () => ({ renderLineChart: renderers.renderLineChart }));
vi.mock('../../../src/modules/visualizations/networkGraph.js', () => ({ renderNetworkGraph: renderers.renderNetworkGraph }));
vi.mock('../../../src/charts/pie/panelAdapter.js', () => ({ renderPiePanelChart: renderers.renderPiePanelChart }));
vi.mock('../../../src/modules/visualizations/scatterPlot.js', () => ({ renderScatterPlot: renderers.renderScatterPlot }));
vi.mock('../../../src/modules/visualizations/tinChart.js', () => ({ renderTinChart: renderers.renderTinChart }));
vi.mock('../../../src/charts/treemap/panelAdapter.js', () => ({ renderTreemapPanelChart: renderers.renderTreemapPanelChart }));
vi.mock('../../../src/charts/scatter3d/panelAdapter.js', () => ({ renderScatter3dPanelChart: renderers.renderScatter3dPanelChart }));
vi.mock('../../../src/services/i18nService.js', () => ({
	t: vi.fn((key) => key),
	getLocale: vi.fn(() => 'en'),
}));

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

	it('dispatches scatter with x, y as positional args and resolves axisTypes from columnsSnapshot', () => {
		renderChartFromSpec(container, makeSpec('scatter', { x: 'a', y: 'b' }));
		expect(renderers.renderScatterPlot).toHaveBeenCalledTimes(1);
		const [, rows, x, y, opts] = renderers.renderScatterPlot.mock.calls[0];
		expect(rows).toBe(baseRows);
		expect(x).toBe('a');
		expect(y).toBe('b');
		expect(opts.axisTypes).toEqual({ x: 'number', y: 'text' });
		expect(opts.xColumn).toBe('a');
		expect(opts.yColumn).toBe('b');
	});

	it('builds axis type indexes from valid columns only', () => {
		renderChartFromSpec(container, {
			...makeSpec('scatter', { x: 'a', y: 'missing' }),
			columnsSnapshot: [null, { type: 'number' }, { name: 'a', type: 'number' }],
		});
		renderChartFromSpec(container, {
			...makeSpec('line', { x: 'a', y: 'b' }),
			columnsSnapshot: null,
		});

		expect(renderers.renderScatterPlot.mock.calls[0][4].axisTypes).toEqual({ x: 'number', y: undefined });
		expect(renderers.renderLineChart.mock.calls[0][4].axisTypes).toEqual({ x: undefined, y: undefined });
	});

	it('dispatches network with source, target as positional args', () => {
		renderChartFromSpec(container, makeSpec('network', { source: 'src', target: 'tgt', weight: 'w' }));
		expect(renderers.renderNetworkGraph).toHaveBeenCalledTimes(1);
		const [, , source, target, opts] = renderers.renderNetworkGraph.mock.calls[0];
		expect(source).toBe('src');
		expect(target).toBe('tgt');
		expect(opts.weightColumn).toBe('w');
		expect(opts.sourceColumn).toBe('src');
		expect(opts.targetColumn).toBe('tgt');
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

	it('dispatches line with x, y as positional args and resolves axisTypes from columnsSnapshot', () => {
		renderChartFromSpec(container, makeSpec('line', { x: 'a', y: 'a', curve: 'monotone', missingMode: 'gap' }));
		expect(renderers.renderLineChart).toHaveBeenCalledTimes(1);
		const [, rows, x, y, opts] = renderers.renderLineChart.mock.calls[0];
		expect(rows).toBe(baseRows);
		expect(x).toBe('a');
		expect(y).toBe('a');
		expect(opts.axisTypes).toEqual({ x: 'number', y: 'number' });
		expect(opts.curve).toBe('monotone');
		expect(opts.missingMode).toBe('gap');
	});

	it('dispatches tin with x, y, z as positional args and without filterCallbacks', () => {
		renderChartFromSpec(container, makeSpec('tin', { x: 'a', y: 'b', z: 'a' }));
		expect(renderers.renderTinChart).toHaveBeenCalledTimes(1);
		const [, rows, x, y, z, opts] = renderers.renderTinChart.mock.calls[0];
		expect(rows).toBe(baseRows);
		expect(x).toBe('a');
		expect(y).toBe('b');
		expect(z).toBe('a');
		// TIN is the lone renderer that does not receive filterCallbacks; the
		// shared baseOptions must not introduce it.
		expect('filterCallbacks' in opts).toBe(false);
	});

	it('uses localized fallback labels when chart columns are missing', () => {
		renderChartFromSpec(container, makeSpec('scatter', { x: '', y: '' }));
		renderChartFromSpec(container, makeSpec('network', { source: '', target: '' }));
		renderChartFromSpec(container, makeSpec('line', { x: '', y: '' }));
		renderChartFromSpec(container, makeSpec('tin', { x: '', y: '', z: '' }));

		expect(renderers.renderScatterPlot.mock.calls[0][4].axisLabels).toEqual({
			x: 'chive-chart-control-scatter-x',
			y: 'chive-chart-control-scatter-y',
		});
		expect(renderers.renderNetworkGraph.mock.calls[0][4].labels.source).toBe('chive-chart-control-network-source');
		expect(renderers.renderNetworkGraph.mock.calls[0][4].labels.target).toBe('chive-chart-control-network-target');
		expect(renderers.renderLineChart.mock.calls[0][4].axisLabels).toEqual({
			x: 'chive-chart-control-line-x',
			y: 'chive-chart-control-line-y',
		});
		expect(renderers.renderTinChart.mock.calls[0][5].axisLabels).toEqual({
			x: 'chive-chart-control-tin-x',
			y: 'chive-chart-control-tin-y',
			z: 'chive-chart-control-tin-z',
		});
	});

	it('accepts chart specs without config objects', () => {
		for (const type of SUPPORTED_PANEL_CHART_TYPES) {
			const spec = makeSpec(type);
			delete spec.config;
			expect(renderChartFromSpec(container, spec).ok).toBe(true);
		}

		expect(renderers.renderBarPanelChart).toHaveBeenCalled();
		expect(renderers.renderScatterPlot).toHaveBeenCalled();
		expect(renderers.renderNetworkGraph).toHaveBeenCalled();
		expect(renderers.renderPiePanelChart).toHaveBeenCalled();
		expect(renderers.renderBubblePanelChart).toHaveBeenCalled();
		expect(renderers.renderTreemapPanelChart).toHaveBeenCalled();
		expect(renderers.renderLineChart).toHaveBeenCalled();
		expect(renderers.renderTinChart).toHaveBeenCalled();
	});

	it('returns renderer failure results unchanged', () => {
		renderers.renderLineChart.mockReturnValueOnce({ ok: false, reason: 'renderer-failed' });

		const result = renderChartFromSpec(container, makeSpec('line', { x: 'a', y: 'a' }));

		expect(result).toEqual({ ok: false, reason: 'renderer-failed' });
	});

	it('passes shared baseOptions (customTitle, chartHeight, locale) through to legacy renderers', () => {
		renderChartFromSpec(container, makeSpec('scatter', { x: 'a', y: 'b', customTitle: 'My chart', chartHeight: 480 }));
		const [, , , , opts] = renderers.renderScatterPlot.mock.calls[0];
		expect(opts.customTitle).toBe('My chart');
		expect(opts.chartHeight).toBe(480);
		expect(opts.locale).toBe('en');
	});
});
