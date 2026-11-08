import { describe, expect, it } from 'vitest';
import { BAR_CONTROLS } from '../../../src/charts/bar/controls/descriptions.js';
import { BUBBLE_CONTROLS } from '../../../src/charts/bubble/controls/descriptions.js';
import { LINE_CONTROLS } from '../../../src/charts/line/controls/descriptions.js';
import { NETWORK_CONTROLS } from '../../../src/charts/network/controls/descriptions.js';
import { PIE_CONTROLS } from '../../../src/charts/pie/controls/descriptions.js';
import { SUPPORTED_CONTROL_CHART_TYPES, getChartControlAdapter } from '../../../src/charts/registries/controls.js';
import { SCATTER_CONTROLS } from '../../../src/charts/scatter/controls/descriptions.js';
import { SCATTER3D_CONTROLS } from '../../../src/charts/scatter3d/controls/descriptions.js';
import { TIN_CONTROLS } from '../../../src/charts/tin/controls/descriptions.js';
import { TREEMAP_CONTROLS } from '../../../src/charts/treemap/controls/descriptions.js';
import { CHART_TYPE_KEYS } from '../../../src/config/charts/definitions.js';

describe('controls registry', () => {
	it('returns null for unknown and inherited keys', () => {
		expect(getChartControlAdapter('histogram')).toBeNull();
		expect(getChartControlAdapter('__proto__')).toBeNull();
	});

	it('has an adapter for every chart type', () => {
		expect(SUPPORTED_CONTROL_CHART_TYPES).toEqual(CHART_TYPE_KEYS);
	});

	it.each([
		['bar', BAR_CONTROLS],
		['line', LINE_CONTROLS],
		['scatter', SCATTER_CONTROLS],
		['scatter3d', SCATTER3D_CONTROLS],
		['pie', PIE_CONTROLS],
		['bubble', BUBBLE_CONTROLS],
		['network', NETWORK_CONTROLS],
		['treemap', TREEMAP_CONTROLS],
		['tin', TIN_CONTROLS],
	])('hands over the %s control descriptions and activation defaults, and nothing else', (type, descriptions) => {
		const adapter = getChartControlAdapter(type);

		expect(Object.keys(adapter)).toEqual(['controls', 'computeDefaults']);
		expect(adapter.controls).toBe(descriptions);
		expect(descriptions.definition.key).toBe(type);
		expect(typeof adapter.computeDefaults).toBe('function');
	});
});
