import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	createNetworkGraphControls: vi.fn(() => []),
	setupNetworkGraphControlListeners: vi.fn(),
	createScatterPlotControls: vi.fn(() => []),
	setupScatterPlotControlListeners: vi.fn(),
	createLineChartControls: vi.fn(() => []),
	setupLineChartControlListeners: vi.fn(),
	createTinControls: vi.fn(() => []),
	setupTinControlListeners: vi.fn(),
	createScatter3dControls: vi.fn(() => []),
	setupScatter3dControlListeners: vi.fn(),
}));

vi.mock('../../../src/charts/network/controls/builder.js', () => ({ createNetworkGraphControls: mocks.createNetworkGraphControls }));
vi.mock('../../../src/charts/network/controls/listeners.js', () => ({ setupNetworkGraphControlListeners: mocks.setupNetworkGraphControlListeners }));
vi.mock('../../../src/charts/scatter/controls/builder.js', () => ({ createScatterPlotControls: mocks.createScatterPlotControls }));
vi.mock('../../../src/charts/scatter/controls/listeners.js', () => ({ setupScatterPlotControlListeners: mocks.setupScatterPlotControlListeners }));
vi.mock('../../../src/charts/line/controls/builder.js', () => ({ createLineChartControls: mocks.createLineChartControls }));
vi.mock('../../../src/charts/line/controls/listeners.js', () => ({ setupLineChartControlListeners: mocks.setupLineChartControlListeners }));
vi.mock('../../../src/charts/tin/controls/builder.js', () => ({ createTinControls: mocks.createTinControls }));
vi.mock('../../../src/charts/tin/controls/listeners.js', () => ({ setupTinControlListeners: mocks.setupTinControlListeners }));
vi.mock('../../../src/charts/scatter3d/controls/builder.js', () => ({ createScatter3dControls: mocks.createScatter3dControls }));
vi.mock('../../../src/charts/scatter3d/controls/listeners.js', () => ({ setupScatter3dControlListeners: mocks.setupScatter3dControlListeners }));

import { BAR_CONTROLS } from '../../../src/charts/bar/controls/descriptions.js';
import { BUBBLE_CONTROLS } from '../../../src/charts/bubble/controls/descriptions.js';
import { PIE_CONTROLS } from '../../../src/charts/pie/controls/descriptions.js';
import { getChartControlAdapter } from '../../../src/charts/registries/controls.js';
import { TREEMAP_CONTROLS } from '../../../src/charts/treemap/controls/descriptions.js';

describe('controls registry', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns null for unknown and inherited keys', () => {
		expect(getChartControlAdapter('histogram')).toBeNull();
		expect(getChartControlAdapter('__proto__')).toBeNull();
	});

	it.each([
		['line', 'createLineChartControls', 'setupLineChartControlListeners', ['numeric', 'dates', 'all'], ['numeric', 'dates', 'all']],
		['scatter', 'createScatterPlotControls', 'setupScatterPlotControlListeners', ['numeric', 'all'], ['numeric', 'all']],
		['scatter3d', 'createScatter3dControls', 'setupScatter3dControlListeners', ['numeric', 'all'], ['numeric', 'all']],
		['network', 'createNetworkGraphControls', 'setupNetworkGraphControlListeners', ['all', 'numeric', 'categorical'], ['all', 'numeric']],
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
			rows: [{ category: 'A', value: 1 }],
		};
		const context = {
			baseCategoricalOrAll: values.base,
			numeric: values.numeric,
			categorical: values.categorical,
			dates: values.dates,
			allColumns: values.all,
			rows: values.rows,
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

	it.each([
		['bar', BAR_CONTROLS],
		['pie', PIE_CONTROLS],
		['treemap', TREEMAP_CONTROLS],
		['bubble', BUBBLE_CONTROLS],
	])('hands over the %s control descriptions, with no builder or listener setup to adapt', (type, descriptions) => {
		const adapter = getChartControlAdapter(type);

		expect(adapter.controls).toBe(descriptions);
		expect(descriptions.definition.key).toBe(type);
		expect(adapter.build).toBeUndefined();
		expect(adapter.attachListeners).toBeUndefined();
		expect(typeof adapter.computeDefaults).toBe('function');
	});
});
