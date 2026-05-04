// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';

const renderers = vi.hoisted(() => ({
	renderBarChart: vi.fn(() => ({ ok: true })),
	renderBubbleChart: vi.fn(() => ({ ok: true })),
	renderNetworkGraph: vi.fn(() => ({ ok: true })),
	renderPieChart: vi.fn(() => ({ ok: true })),
	renderScatterPlot: vi.fn(() => ({ ok: true })),
	renderTreeMap: vi.fn(() => ({ ok: true })),
}));

vi.mock('../../../src/modules/visualizations/index.js', () => renderers);
vi.mock('../../../src/services/i18nService.js', () => ({
	t: vi.fn((key) => key),
	getLocale: vi.fn(() => 'en'),
}));

import { renderChartFromSpec, SUPPORTED_PANEL_CHART_TYPES } from '../../../src/modules/panel/renderChartFromSpec.js';

const baseRows = [{ a: 1 }, { a: 2 }];
const baseColumns = [
	{ nome: 'a', tipo: 'numero' },
	{ nome: 'b', tipo: 'texto' },
];

function makeSpec(type, configOverrides = {}) {
	return {
		id: 1,
		nome: 'Test',
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
		expect(SUPPORTED_PANEL_CHART_TYPES).toEqual(['bar', 'scatter', 'network', 'pie', 'bubble', 'treemap']);
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

	it('dispatches scatter with x, y as positional args and resolves axisTypes from columnsSnapshot', () => {
		renderChartFromSpec(container, makeSpec('scatter', { x: 'a', y: 'b' }));
		expect(renderers.renderScatterPlot).toHaveBeenCalledTimes(1);
		const [, rows, x, y, opts] = renderers.renderScatterPlot.mock.calls[0];
		expect(rows).toBe(baseRows);
		expect(x).toBe('a');
		expect(y).toBe('b');
		expect(opts.axisTypes).toEqual({ x: 'numero', y: 'texto' });
		expect(opts.xColumn).toBe('a');
		expect(opts.yColumn).toBe('b');
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
});
