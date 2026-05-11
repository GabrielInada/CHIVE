// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/modules/chart-controls/previews.js', () => ({
	PREVIEW_BAR_SVG: '<svg data-prev="bar" />',
	PREVIEW_SCATTER_SVG: '<svg data-prev="scatter" />',
	PREVIEW_PIE_SVG: '<svg data-prev="pie" />',
	PREVIEW_BUBBLE_SVG: '<svg data-prev="bubble" />',
	PREVIEW_NETWORK_SVG: '<svg data-prev="network" />',
	PREVIEW_TREEMAP_SVG: '<svg data-prev="treemap" />',
}));

import { CHART_TYPES, renderChartListDOM } from '../../../src/components/results/chartListView.js';

const translate = key => `t:${key}`;

function setup({ activeChartType = null, onSelect = vi.fn() } = {}) {
	document.body.innerHTML = '<div id="chart-list"></div>';
	const container = document.getElementById('chart-list');
	renderChartListDOM({ container, activeChartType, translate, onSelect });
	return { container, onSelect };
}

describe('renderChartListDOM', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('renders one row per CHART_TYPES entry in order', () => {
		const { container } = setup();
		const rows = container.querySelectorAll('.viz-chart-row');
		expect(rows.length).toBe(CHART_TYPES.length);
		const types = Array.from(rows).map(r => r.dataset.chartType);
		expect(types).toEqual(CHART_TYPES);
	});

	it('renders translated name + category tag + preview SVG on each row', () => {
		const { container } = setup();
		const barRow = container.querySelector('[data-chart-type="bar"]');
		expect(barRow.querySelector('.viz-chart-row-name')?.textContent).toBe('t:chive-chart-toggle-bar');
		expect(barRow.querySelector('.viz-chart-row-category')?.textContent).toBe('t:chive-viz-category-comparison');
		expect(barRow.querySelector('svg[data-prev="bar"]')).not.toBeNull();
	});

	it('marks only the active chart type with .ativo', () => {
		const { container } = setup({ activeChartType: 'pie' });
		const active = container.querySelectorAll('.viz-chart-row.ativo');
		expect(active.length).toBe(1);
		expect(active[0].dataset.chartType).toBe('pie');
	});

	it('renders no .ativo row when activeChartType is null', () => {
		const { container } = setup({ activeChartType: null });
		expect(container.querySelectorAll('.viz-chart-row.ativo').length).toBe(0);
	});

	it('clicking a non-active row calls onSelect with that chart type', () => {
		const { container, onSelect } = setup({ activeChartType: 'bar' });
		container.querySelector('[data-chart-type="scatter"]').click();
		expect(onSelect).toHaveBeenCalledWith('scatter');
	});

	it('clicking the active row calls onSelect with null (deselect)', () => {
		const { container, onSelect } = setup({ activeChartType: 'bar' });
		container.querySelector('[data-chart-type="bar"]').click();
		expect(onSelect).toHaveBeenCalledWith(null);
	});

	it('clicking inside a child element still resolves to the row', () => {
		const { container, onSelect } = setup({ activeChartType: null });
		const scatterRow = container.querySelector('[data-chart-type="scatter"]');
		scatterRow.querySelector('.viz-chart-row-name').click();
		expect(onSelect).toHaveBeenCalledWith('scatter');
	});

	it('clicking outside any row does nothing', () => {
		const { container, onSelect } = setup();
		container.click();
		expect(onSelect).not.toHaveBeenCalled();
	});

	it('rerendering replaces previous rows (no duplication)', () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		renderChartListDOM({ container, activeChartType: 'bar', translate, onSelect: vi.fn() });
		renderChartListDOM({ container, activeChartType: 'scatter', translate, onSelect: vi.fn() });
		expect(container.querySelectorAll('.viz-chart-row').length).toBe(CHART_TYPES.length);
		expect(container.querySelector('.viz-chart-row.ativo')?.dataset.chartType).toBe('scatter');
	});
});
