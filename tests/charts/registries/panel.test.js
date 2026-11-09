// @vitest-environment jsdom

/**
 * The Panel registry and render bridge. Captures render for real into jsdom;
 * only the 3D scatter's WebGL renderer is replaced, since jsdom has no WebGL.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../src/i18n/en.json';
import { CHART_DEFINITIONS } from '../../../src/config/charts/definitions.js';
import { getPanelChartRenderer, SUPPORTED_PANEL_CHART_TYPES } from '../../../src/charts/registries/panel.js';
import { renderChartFromSpec } from '../../../src/features/panel/slots/renderChartFromSpec.js';
import { clearChartContainer } from '../../../src/charts/shared/containerLifecycle.js';

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
const columnsSnapshot = [
	{ name: 'team', type: 'text' },
	{ name: 'sales', type: 'number' },
	{ name: 'profit', type: 'number' },
	{ name: 'source', type: 'text' },
	{ name: 'target', type: 'text' },
	{ name: 'x', type: 'number' },
	{ name: 'y', type: 'number' },
	{ name: 'z', type: 'number' },
];

// The columns each chart draws `rows` from.
const columns = {
	bar: { category: 'team' },
	line: { x: 'x', y: 'y' },
	scatter: { x: 'sales', y: 'profit' },
	scatter3d: { x: 'x', y: 'y', z: 'z' },
	pie: { category: 'team' },
	bubble: { category: 'team' },
	network: { source: 'source', target: 'target' },
	treemap: { category: 'team' },
	tin: { x: 'x', y: 'y', z: 'z' },
};
const svgTypes = SUPPORTED_PANEL_CHART_TYPES.filter(type => type !== 'scatter3d');

// Like the WebGL renderer, empty the container through the dispose contract first.
function drawCanvas(container) {
	clearChartContainer(container);
	const canvas = document.createElement('canvas');
	canvas.className = 'chart-canvas-3d';
	container.append(canvas);
	return { ok: true, renderedCount: 0, validCount: 0, totalCount: 0, sampled: false };
}

function configFor(type, overrides = {}) {
	return { ...CHART_DEFINITIONS[type].createDefaultConfig(), ...columns[type], ...overrides };
}

function mount() {
	const container = document.createElement('div');
	document.body.append(container);
	return container;
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
	for (const container of document.body.children) container.__chive_network_simulation__?.stop();
});

describe('panel chart registry and render bridge', () => {
	it('exposes the supported renderer types', () => {
		expect(SUPPORTED_PANEL_CHART_TYPES).toEqual(['bar', 'line', 'scatter', 'scatter3d', 'pie', 'bubble', 'network', 'treemap', 'tin']);
	});

	it('returns null from the registry for unknown and inherited keys', () => {
		expect(getPanelChartRenderer('sankey')).toBeNull();
		expect(getPanelChartRenderer('__proto__')).toBeNull();
	});

	it('returns invalid-args when container or spec is missing', () => {
		expect(renderChartFromSpec(null, { type: 'bar' })).toEqual({ ok: false, reason: 'invalid-args' });
		expect(renderChartFromSpec(mount(), null)).toEqual({ ok: false, reason: 'invalid-args' });
	});

	it('returns unknown-type for unsupported chart types', () => {
		expect(renderChartFromSpec(mount(), { type: 'sankey', config: {}, dataSnapshot: rows })).toEqual({ ok: false, reason: 'unknown-type' });
	});

	it("returns the chart's own result", () => {
		const spec = { type: 'pie', config: configFor('pie', { measureMode: 'sum', valueColumn: null }), dataSnapshot: rows, columnsSnapshot };

		expect(renderChartFromSpec(mount(), spec)).toEqual({ ok: false, reason: 'no-value-column' });
	});
});

describe('Panel captures', () => {
	it.each(svgTypes)('%s: a capture without rows draws like a capture with no rows', type => {
		const config = configFor(type);
		const expected = mount();
		const expectedResult = getPanelChartRenderer(type)(expected, { type, config, dataSnapshot: [], columnsSnapshot });
		const container = mount();

		const result = getPanelChartRenderer(type)(container, { type, config, columnsSnapshot });

		expect(result).toEqual(expectedResult);
		expect(container.querySelector('.chart-empty').textContent).toBe(expected.querySelector('.chart-empty').textContent);
	});

	it.each(svgTypes)("%s: a capture without config shows the chart's empty-state message", type => {
		const container = mount();

		const result = getPanelChartRenderer(type)(container, { type, dataSnapshot: rows, columnsSnapshot });

		expect(result.ok).toBe(false);
		expect(container.querySelector('.chart-empty').textContent).toBe(en[`chive-chart-empty-${type}`]);
	});

	it('scatter3d: a capture without rows or config reaches the renderer with no rows', async () => {
		renderChartFromSpec(mount(), { type: 'scatter3d' });

		await vi.waitFor(() => expect(three.renderScatter3dChart).toHaveBeenCalledTimes(1));
		expect(three.renderScatter3dChart.mock.calls[0][1]).toEqual([]);
	});

	it.each(['line', 'scatter'])('%s: the x axis follows the captured column types', type => {
		const dataSnapshot = [{ code: 1, value: 5 }, { code: 2, value: 7 }, { code: 10, value: 6 }];
		const config = configFor(type, { x: 'code', y: 'value' });
		const container = mount();

		getPanelChartRenderer(type)(container, { type, config, dataSnapshot, columnsSnapshot: [{ name: 'code', type: 'text' }, { name: 'value', type: 'number' }] });
		expect(new Set(xTickLabels(container))).toEqual(new Set(['1', '2', '10']));

		getPanelChartRenderer(type)(container, { type, config, dataSnapshot, columnsSnapshot: [{ name: 'code', type: 'number' }, { name: 'value', type: 'number' }] });
		expect(xTickLabels(container)).toContain('4');
	});

	it.each(['line', 'scatter'])('%s: a capture without column types still draws', type => {
		const container = mount();

		const result = getPanelChartRenderer(type)(container, { type, config: configFor(type), dataSnapshot: rows });

		expect(result.ok).toBe(true);
		expect(container.querySelector('svg')).not.toBeNull();
	});
});
