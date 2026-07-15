import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	createBarChartControls: vi.fn(() => []),
	setupBarChartControlListeners: vi.fn(),
	createBubbleChartControls: vi.fn(() => []),
	setupBubbleChartControlListeners: vi.fn(),
	createNetworkGraphControls: vi.fn(() => []),
	setupNetworkGraphControlListeners: vi.fn(),
	createScatterPlotControls: vi.fn(() => []),
	setupScatterPlotControlListeners: vi.fn(),
	createPieChartControls: vi.fn(() => []),
	setupPieChartControlListeners: vi.fn(),
	createTreeMapControls: vi.fn(() => []),
	setupTreeMapControlListeners: vi.fn(),
	createLineChartControls: vi.fn(() => []),
	setupLineChartControlListeners: vi.fn(),
	createTinControls: vi.fn(() => []),
	setupTinControlListeners: vi.fn(),
	createScatter3dControls: vi.fn(() => []),
	setupScatter3dControlListeners: vi.fn(),
}));

vi.mock('../../../src/charts/bar/controls/builder.js', () => ({ createBarChartControls: mocks.createBarChartControls }));
vi.mock('../../../src/charts/bar/controls/listeners.js', () => ({ setupBarChartControlListeners: mocks.setupBarChartControlListeners }));
vi.mock('../../../src/charts/bubble/controls/builder.js', () => ({ createBubbleChartControls: mocks.createBubbleChartControls }));
vi.mock('../../../src/charts/bubble/controls/listeners.js', () => ({ setupBubbleChartControlListeners: mocks.setupBubbleChartControlListeners }));
vi.mock('../../../src/charts/network/controls/builder.js', () => ({ createNetworkGraphControls: mocks.createNetworkGraphControls }));
vi.mock('../../../src/charts/network/controls/listeners.js', () => ({ setupNetworkGraphControlListeners: mocks.setupNetworkGraphControlListeners }));
vi.mock('../../../src/charts/scatter/controls/builder.js', () => ({ createScatterPlotControls: mocks.createScatterPlotControls }));
vi.mock('../../../src/charts/scatter/controls/listeners.js', () => ({ setupScatterPlotControlListeners: mocks.setupScatterPlotControlListeners }));
vi.mock('../../../src/charts/pie/controls/builder.js', () => ({ createPieChartControls: mocks.createPieChartControls }));
vi.mock('../../../src/charts/pie/controls/listeners.js', () => ({ setupPieChartControlListeners: mocks.setupPieChartControlListeners }));
vi.mock('../../../src/charts/treemap/controls/builder.js', () => ({ createTreeMapControls: mocks.createTreeMapControls }));
vi.mock('../../../src/charts/treemap/controls/listeners.js', () => ({ setupTreeMapControlListeners: mocks.setupTreeMapControlListeners }));
vi.mock('../../../src/charts/line/controls/builder.js', () => ({ createLineChartControls: mocks.createLineChartControls }));
vi.mock('../../../src/charts/line/controls/listeners.js', () => ({ setupLineChartControlListeners: mocks.setupLineChartControlListeners }));
vi.mock('../../../src/charts/tin/controls/builder.js', () => ({ createTinControls: mocks.createTinControls }));
vi.mock('../../../src/charts/tin/controls/listeners.js', () => ({ setupTinControlListeners: mocks.setupTinControlListeners }));
vi.mock('../../../src/charts/scatter3d/controls/builder.js', () => ({ createScatter3dControls: mocks.createScatter3dControls }));
vi.mock('../../../src/charts/scatter3d/controls/listeners.js', () => ({ setupScatter3dControlListeners: mocks.setupScatter3dControlListeners }));

import { getChartControlAdapter } from '../../../src/charts/registries/controls.js';

describe('controls registry', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns null for unknown and inherited keys', () => {
		expect(getChartControlAdapter('histogram')).toBeNull();
		expect(getChartControlAdapter('__proto__')).toBeNull();
	});

	it.each([
		['bar', 'createBarChartControls', 'setupBarChartControlListeners', ['base', 'numeric', 'all'], ['base', 'numeric', 'all']],
		['line', 'createLineChartControls', 'setupLineChartControlListeners', ['numeric', 'dates', 'all'], ['numeric', 'dates', 'all']],
		['scatter', 'createScatterPlotControls', 'setupScatterPlotControlListeners', ['numeric', 'all'], ['numeric', 'all']],
		['scatter3d', 'createScatter3dControls', 'setupScatter3dControlListeners', ['numeric', 'all'], ['numeric', 'all']],
		['pie', 'createPieChartControls', 'setupPieChartControlListeners', ['base', 'numeric', 'all'], ['base', 'numeric', 'all']],
		['bubble', 'createBubbleChartControls', 'setupBubbleChartControlListeners', ['base', 'numeric', 'all'], ['base', 'numeric', 'all']],
		['network', 'createNetworkGraphControls', 'setupNetworkGraphControlListeners', ['all', 'numeric', 'categorical'], ['all', 'numeric']],
		['treemap', 'createTreeMapControls', 'setupTreeMapControlListeners', ['base', 'numeric', 'all'], ['base', 'numeric', 'all']],
		['tin', 'createTinControls', 'setupTinControlListeners', ['numeric', 'all'], ['numeric', 'all']],
	])('preserves the %s controls adapter signatures and forwards the writer', (type, buildMock, listenerMock, buildKeys, listenerKeys) => {
		const dataset = { chartConfig: {} };
		const writer = { commit: vi.fn(), preview: vi.fn() };
		const values = {
			base: ['category'],
			numeric: ['value'],
			categorical: ['category'],
			dates: ['date'],
			all: ['category', 'value', 'date'],
		};
		const context = {
			baseCategoricalOrAll: values.base,
			numeric: values.numeric,
			categorical: values.categorical,
			dates: values.dates,
			allColumns: values.all,
		};
		const adapter = getChartControlAdapter(type);

		adapter.build(dataset, context);
		adapter.attachListeners(dataset, context, writer);

		expect(mocks[buildMock]).toHaveBeenCalledWith(
			dataset,
			...buildKeys.map(key => values[key]),
		);
		// The writer arrives last and is the exact instance the caller passed, so
		// every package writes through the same adapter rather than importing
		// state for itself.
		expect(mocks[listenerMock]).toHaveBeenCalledWith(
			dataset,
			...listenerKeys.map(key => values[key]),
			writer,
		);
		expect(mocks[listenerMock].mock.calls[0].at(-1)).toBe(writer);
	});
});
