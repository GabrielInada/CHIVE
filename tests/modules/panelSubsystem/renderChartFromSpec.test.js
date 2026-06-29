// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';

const renderers = vi.hoisted(() => ({
	renderBarChart: vi.fn(() => ({ ok: true })),
	renderBubbleChart: vi.fn(() => ({ ok: true })),
	renderLineChart: vi.fn(() => ({ ok: true })),
	renderNetworkGraph: vi.fn(() => ({ ok: true })),
	renderPieChart: vi.fn(() => ({ ok: true })),
	renderScatterPlot: vi.fn(() => ({ ok: true })),
	renderTreeMap: vi.fn(() => ({ ok: true })),
	renderTinChart: vi.fn(() => ({ ok: true })),
}));

vi.mock('../../../src/modules/visualizations/barChart.js', () => ({ renderBarChart: renderers.renderBarChart }));
vi.mock('../../../src/modules/visualizations/bubbleChart.js', () => ({ renderBubbleChart: renderers.renderBubbleChart }));
vi.mock('../../../src/modules/visualizations/lineChart.js', () => ({ renderLineChart: renderers.renderLineChart }));
vi.mock('../../../src/modules/visualizations/networkGraph.js', () => ({ renderNetworkGraph: renderers.renderNetworkGraph }));
vi.mock('../../../src/modules/visualizations/pieChart.js', () => ({ renderPieChart: renderers.renderPieChart }));
vi.mock('../../../src/modules/visualizations/scatterPlot.js', () => ({ renderScatterPlot: renderers.renderScatterPlot }));
vi.mock('../../../src/modules/visualizations/tinChart.js', () => ({ renderTinChart: renderers.renderTinChart }));
vi.mock('../../../src/modules/visualizations/treemapChart.js', () => ({ renderTreeMap: renderers.renderTreeMap }));
vi.mock('../../../src/services/i18nService.js', () => ({
	t: vi.fn((key) => key),
	getLocale: vi.fn(() => 'en'),
}));

import { renderChartFromSpec, SUPPORTED_PANEL_CHART_TYPES } from '../../../src/modules/panelSubsystem/renderChartFromSpec.js';

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

describe('renderChartFromSpec', () => {
	let container;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		Object.values(renderers).forEach(fn => fn.mockClear());
	});

	it('exposes the supported renderer types', () => {
		expect(SUPPORTED_PANEL_CHART_TYPES).toEqual(['bar', 'scatter', 'network', 'pie', 'bubble', 'treemap', 'line', 'tin']);
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

	it('dispatches bar with category as the third positional arg and a count fallback measure', () => {
		renderChartFromSpec(container, makeSpec('bar', { category: 'a' }));
		expect(renderers.renderBarChart).toHaveBeenCalledTimes(1);
		const [el, rows, category, opts] = renderers.renderBarChart.mock.calls[0];
		expect(el).toBe(container);
		expect(rows).toBe(baseRows);
		expect(category).toBe('a');
		expect(opts.measureMode).toBe('count');
		expect(opts.filterCallbacks).toEqual({});
	});

	it('labels bar aggregates for sum and mean measures', () => {
		renderChartFromSpec(container, makeSpec('bar', { category: 'a', measureMode: 'sum' }));
		renderChartFromSpec(container, makeSpec('bar', { category: 'a', measureMode: 'mean' }));

		expect(renderers.renderBarChart.mock.calls[0][3].axisLabels.y).toBe('chive-tooltip-sum');
		expect(renderers.renderBarChart.mock.calls[1][3].axisLabels.y).toBe('chive-tooltip-mean');
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

	it('dispatches pie with category as the third positional arg', () => {
		renderChartFromSpec(container, makeSpec('pie', { category: 'a', measureMode: 'sum', valueColumn: 'a' }));
		expect(renderers.renderPieChart).toHaveBeenCalledTimes(1);
		const [, , category, opts] = renderers.renderPieChart.mock.calls[0];
		expect(category).toBe('a');
		expect(opts.measureMode).toBe('sum');
		expect(opts.valueColumn).toBe('a');
	});

	it('dispatches bubble with category and falls back to count for invalid measureMode', () => {
		renderChartFromSpec(container, makeSpec('bubble', { category: 'a', measureMode: 'bogus' }));
		expect(renderers.renderBubbleChart).toHaveBeenCalledTimes(1);
		const [, , category, opts] = renderers.renderBubbleChart.mock.calls[0];
		expect(category).toBe('a');
		expect(opts.measureMode).toBe('count');
	});

	it('dispatches treemap with category as the third positional arg', () => {
		renderChartFromSpec(container, makeSpec('treemap', { category: 'a', topN: 5 }));
		expect(renderers.renderTreeMap).toHaveBeenCalledTimes(1);
		const [, , category, opts] = renderers.renderTreeMap.mock.calls[0];
		expect(category).toBe('a');
		expect(opts.topN).toBe(5);
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
		renderChartFromSpec(container, makeSpec('bar', { category: '' }));
		renderChartFromSpec(container, makeSpec('scatter', { x: '', y: '' }));
		renderChartFromSpec(container, makeSpec('network', { source: '', target: '' }));
		renderChartFromSpec(container, makeSpec('line', { x: '', y: '' }));
		renderChartFromSpec(container, makeSpec('tin', { x: '', y: '', z: '' }));

		expect(renderers.renderBarChart.mock.calls[0][3].axisLabels.x).toBe('chive-chart-control-bar-category');
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

		expect(renderers.renderBarChart).toHaveBeenCalled();
		expect(renderers.renderScatterPlot).toHaveBeenCalled();
		expect(renderers.renderNetworkGraph).toHaveBeenCalled();
		expect(renderers.renderPieChart).toHaveBeenCalled();
		expect(renderers.renderBubbleChart).toHaveBeenCalled();
		expect(renderers.renderTreeMap).toHaveBeenCalled();
		expect(renderers.renderLineChart).toHaveBeenCalled();
		expect(renderers.renderTinChart).toHaveBeenCalled();
	});

	it('returns renderer failure results unchanged', () => {
		renderers.renderLineChart.mockReturnValueOnce({ ok: false, reason: 'renderer-failed' });

		const result = renderChartFromSpec(container, makeSpec('line', { x: 'a', y: 'a' }));

		expect(result).toEqual({ ok: false, reason: 'renderer-failed' });
	});

	it('passes shared baseOptions (customTitle, chartHeight, locale) through to renderers', () => {
		renderChartFromSpec(container, makeSpec('bar', { category: 'a', customTitle: 'My chart', chartHeight: 480 }));
		const [, , , opts] = renderers.renderBarChart.mock.calls[0];
		expect(opts.customTitle).toBe('My chart');
		expect(opts.chartHeight).toBe(480);
		expect(opts.locale).toBe('en');
	});
});
