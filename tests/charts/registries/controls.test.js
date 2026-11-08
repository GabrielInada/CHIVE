import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	createScatterPlotControls: vi.fn(() => []),
	setupScatterPlotControlListeners: vi.fn(),
}));

vi.mock('../../../src/charts/scatter/controls/builder.js', () => ({ createScatterPlotControls: mocks.createScatterPlotControls }));
vi.mock('../../../src/charts/scatter/controls/listeners.js', () => ({ setupScatterPlotControlListeners: mocks.setupScatterPlotControlListeners }));

import { BAR_CONTROLS } from '../../../src/charts/bar/controls/descriptions.js';
import { BUBBLE_CONTROLS } from '../../../src/charts/bubble/controls/descriptions.js';
import { LINE_CONTROLS } from '../../../src/charts/line/controls/descriptions.js';
import { NETWORK_CONTROLS } from '../../../src/charts/network/controls/descriptions.js';
import { PIE_CONTROLS } from '../../../src/charts/pie/controls/descriptions.js';
import { getChartControlAdapter } from '../../../src/charts/registries/controls.js';
import { SCATTER3D_CONTROLS } from '../../../src/charts/scatter3d/controls/descriptions.js';
import { TIN_CONTROLS } from '../../../src/charts/tin/controls/descriptions.js';
import { TREEMAP_CONTROLS } from '../../../src/charts/treemap/controls/descriptions.js';

describe('controls registry', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns null for unknown and inherited keys', () => {
		expect(getChartControlAdapter('histogram')).toBeNull();
		expect(getChartControlAdapter('__proto__')).toBeNull();
	});

	it('preserves the scatter controls adapter signatures and forwards the writer', () => {
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
		const adapter = getChartControlAdapter('scatter');

		adapter.build(dataset, context);
		adapter.attachListeners(dataset, context, writer);

		expect(mocks.createScatterPlotControls).toHaveBeenCalledWith(dataset, values.numeric, values.all);
		// The writer arrives last and is the exact instance the caller passed, so
		// the package writes through the same adapter rather than importing state
		// for itself.
		expect(mocks.setupScatterPlotControlListeners).toHaveBeenCalledWith(dataset, values.numeric, values.all, writer);
		expect(mocks.setupScatterPlotControlListeners.mock.calls[0].at(-1)).toBe(writer);
	});

	it.each([
		['bar', BAR_CONTROLS],
		['line', LINE_CONTROLS],
		['scatter3d', SCATTER3D_CONTROLS],
		['pie', PIE_CONTROLS],
		['bubble', BUBBLE_CONTROLS],
		['network', NETWORK_CONTROLS],
		['treemap', TREEMAP_CONTROLS],
		['tin', TIN_CONTROLS],
	])('hands over the %s control descriptions, with no builder or listener setup to adapt', (type, descriptions) => {
		const adapter = getChartControlAdapter(type);

		expect(adapter.controls).toBe(descriptions);
		expect(descriptions.definition.key).toBe(type);
		expect(adapter.build).toBeUndefined();
		expect(adapter.attachListeners).toBeUndefined();
		expect(typeof adapter.computeDefaults).toBe('function');
	});
});
