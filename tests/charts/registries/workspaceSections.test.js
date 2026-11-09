// @vitest-environment jsdom

/**
 * The Visualizations section of every chart, through the workspace registry:
 * block visibility, the min height, the dispose contract and the inputs each
 * chart draws from. Charts render for real into jsdom; only the 3D scatter's
 * WebGL renderer is replaced, since jsdom has no WebGL.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../src/i18n/en.json';
import { CHART_DEFINITIONS, CHART_TYPE_KEYS } from '../../../src/config/charts/definitions.js';
import { renderWorkspaceChart } from '../../../src/charts/registries/workspace.js';
import { CHART_BLOCKS, CHART_CONTAINERS } from '../../../src/charts/workspaceDomIds.js';
import { CHART_DISPOSE_HOOK, clearChartContainer } from '../../../src/charts/shared/containerLifecycle.js';
import { hideChartTooltip } from '../../../src/charts/shared/tooltip/tooltip.js';

const three = vi.hoisted(() => ({ renderScatter3dChart: vi.fn() }));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: (key, ...params) => (en[key] ?? key).replace(/\$(\d+)/g, (_, n) => String(params[n - 1])),
	getLocale: () => 'en',
}));
vi.mock('../../../src/charts/scatter3d/renderers/three.js', () => three);

const rows = [
	{ team: 'A', sales: 10, profit: 4, source: 'A', target: 'B', x: 1, y: 2, z: 3 },
	{ team: 'B', sales: 20, profit: 6, source: 'B', target: 'C', x: 2, y: 1, z: 5 },
	{ team: 'C', sales: 15, profit: 9, source: 'C', target: 'A', x: 3, y: 3, z: 4 },
	{ team: 'D', sales: 5, profit: 2, source: 'A', target: 'C', x: 1.5, y: 2.5, z: 6 },
];
const columnTypeByName = {
	team: 'text', sales: 'number', profit: 'number', source: 'text', target: 'text', x: 'number', y: 'number', z: 'number',
};

// The columns each chart draws `rows` from, and a mark it draws.
const drawn = {
	bar: [{ category: 'team' }, 'rect'],
	line: [{ x: 'x', y: 'y' }, '.line-path-main'],
	scatter: [{ x: 'sales', y: 'profit' }, '.scatter-point'],
	scatter3d: [{ x: 'x', y: 'y', z: 'z' }, '.chart-canvas-3d'],
	pie: [{ category: 'team' }, 'path'],
	bubble: [{ category: 'team' }, '.bubble-node'],
	network: [{ source: 'source', target: 'target' }, '.network-node'],
	treemap: [{ category: 'team' }, 'rect'],
	tin: [{ x: 'x', y: 'y', z: 'z' }, 'path'],
};

// Like the WebGL renderer, empty the container through the dispose contract first.
function drawCanvas(container) {
	clearChartContainer(container);
	const canvas = document.createElement('canvas');
	canvas.className = 'chart-canvas-3d';
	container.append(canvas);
	return { ok: true, renderedCount: 4, validCount: 4, totalCount: 4, sampled: false };
}

function mount(type) {
	const block = document.createElement('section');
	block.id = CHART_BLOCKS[type];
	const container = document.createElement('div');
	container.id = CHART_CONTAINERS[type];
	block.append(container);
	document.body.append(block);
	return { block, container };
}

function configFor(type, overrides = {}) {
	return { ...CHART_DEFINITIONS[type].createDefaultConfig(), ...drawn[type][0], enabled: true, ...overrides };
}

function render(type, config, input = {}) {
	renderWorkspaceChart(type, { config, rows, columnTypeByName, filterCallbacks: {}, ...input });
}

function xTickLabels(container) {
	const axis = [...container.querySelectorAll('svg g')]
		.find(group => /^translate\(0,/.test(group.getAttribute('transform') || '') && group.querySelector('.tick'));
	return [...axis.querySelectorAll('.tick text')].map(text => text.textContent);
}

beforeEach(() => {
	document.body.replaceChildren();
	three.renderScatter3dChart.mockReset();
	three.renderScatter3dChart.mockImplementation(drawCanvas);
});

afterEach(() => {
	hideChartTooltip();
	document.getElementById(CHART_CONTAINERS.network)?.__chive_network_simulation__?.stop();
});

describe('the Visualizations section of each chart', () => {
	it('returns false for unknown and inherited chart types', () => {
		const input = { config: { enabled: true }, rows, columnTypeByName, filterCallbacks: {} };

		expect(renderWorkspaceChart('histogram', input)).toBe(false);
		expect(renderWorkspaceChart('__proto__', input)).toBe(false);
	});

	it.each(CHART_TYPE_KEYS)('%s: a disabled chart hides its block and clears its container through the dispose hook', type => {
		const { block, container } = mount(type);
		container.append(document.createElement('span'));
		const dispose = vi.fn();
		container[CHART_DISPOSE_HOOK] = dispose;

		render(type, configFor(type, { enabled: false }));

		expect(block.hidden).toBe(true);
		expect(container.childElementCount).toBe(0);
		expect(dispose).toHaveBeenCalledTimes(1);
	});

	it.each(CHART_TYPE_KEYS)('%s: an enabled chart shows its block at the stored height and draws', async type => {
		const { block, container } = mount(type);
		block.hidden = true;
		const { min, max } = CHART_DEFINITIONS[type].heightLimits;
		const chartHeight = Math.round((min + max) / 2);

		render(type, configFor(type, { chartHeight }));

		expect(block.hidden).toBe(false);
		expect(container.style.minHeight).toBe(`${chartHeight}px`);
		await vi.waitFor(() => expect(container.querySelector(drawn[type][1])).not.toBeNull());
		expect(container.querySelector('.chart-empty')).toBeNull();
	});

	const heightCases = CHART_TYPE_KEYS.flatMap(type => {
		const { min, max } = CHART_DEFINITIONS[type].heightLimits;
		const fallback = CHART_DEFINITIONS[type].createDefaultConfig().chartHeight;
		return [
			[type, undefined, fallback],
			[type, 0, min],
			[type, '500', 500],
			[type, 'tall', fallback],
			[type, max + 500, max],
			[type, min - 100, min],
		];
	});

	it.each(heightCases)('%s: a stored height of %j gives a min height of %ipx', (type, chartHeight, expected) => {
		const { container } = mount(type);

		render(type, configFor(type, { chartHeight }));

		expect(container.style.minHeight).toBe(`${expected}px`);
	});

	it.each([
		['bar', { category: 'team' }, 'rect', ['team']],
		['pie', { category: 'team' }, 'path', ['team']],
		['treemap', { category: 'team' }, 'rect', ['team']],
		['bubble', { category: 'team' }, '.bubble-node', ['team']],
		['network', { source: 'source', target: 'target' }, '.network-node', ['source', 'target']],
		['scatter', { x: 'team', y: 'sales' }, '.scatter-point', ['team']],
	])('%s: the filter callbacks reach the pinned tooltip', (type, columns, selector, filterColumns) => {
		const onFocusGlobalFilter = vi.fn();
		const { container } = mount(type);

		render(type, configFor(type, columns), { filterCallbacks: { onFocusGlobalFilter } });
		container.querySelector(selector).dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 100, clientY: 100 }));
		const action = document.querySelector('.chart-tooltip .chart-tooltip__action');
		action.click();

		expect(onFocusGlobalFilter).toHaveBeenCalledTimes(1);
		expect(filterColumns).toContain(onFocusGlobalFilter.mock.calls[0][0]);
	});

	it.each(['line', 'scatter'])('%s: the x axis follows the column type it is given', type => {
		const { container } = mount(type);
		const axisRows = [{ code: 1, value: 5 }, { code: 2, value: 7 }, { code: 10, value: 6 }];
		const config = configFor(type, { x: 'code', y: 'value' });

		render(type, config, { rows: axisRows, columnTypeByName: { code: 'text', value: 'number' } });
		expect(new Set(xTickLabels(container))).toEqual(new Set(['1', '2', '10']));

		render(type, config, { rows: axisRows, columnTypeByName: { code: 'number', value: 'number' } });
		expect(xTickLabels(container)).toContain('4');
	});

	it('scatter3d: hiding the chart while its renderer loads cancels the render', async () => {
		const { container } = mount('scatter3d');
		render('scatter3d', configFor('scatter3d'));
		await vi.waitFor(() => expect(three.renderScatter3dChart).toHaveBeenCalledTimes(1));

		render('scatter3d', configFor('scatter3d'));
		render('scatter3d', configFor('scatter3d', { enabled: false }));
		await new Promise(resolve => setTimeout(resolve, 0));

		expect(three.renderScatter3dChart).toHaveBeenCalledTimes(1);
		expect(container.childElementCount).toBe(0);
	});
});
