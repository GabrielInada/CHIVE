// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHART_CATALOG } from '../../../src/charts/catalog.js';
import { SUPPORTED_CONTROL_CHART_TYPES } from '../../../src/charts/registries/controls.js';
import { SUPPORTED_PANEL_CHART_TYPES } from '../../../src/charts/registries/panel.js';
import { SUPPORTED_WORKSPACE_CHART_TYPES } from '../../../src/charts/registries/workspace.js';
import { createDefaultChartConfig } from '../../../src/config/charts/defaults.js';
import {
	CHART_DEFINITIONS,
	CHART_TYPE_KEYS,
} from '../../../src/config/charts/definitions.js';
import { CHART_BLOCKS, CHART_CONTAINERS } from '../../../src/charts/workspaceDomIds.js';
import en from '../../../src/i18n/en.json';

const EXPECTED_CHART_TYPE_KEYS = [
	'bar',
	'line',
	'scatter',
	'scatter3d',
	'pie',
	'bubble',
	'network',
	'treemap',
	'tin',
];

function sorted(values) {
	return [...values].sort();
}

describe('chart-type metadata', () => {
	it('defines one immutable canonical identity list in visual order', () => {
		expect(CHART_TYPE_KEYS).toEqual(EXPECTED_CHART_TYPE_KEYS);
		expect(new Set(CHART_TYPE_KEYS).size).toBe(CHART_TYPE_KEYS.length);
		expect(Object.isFrozen(CHART_TYPE_KEYS)).toBe(true);
		expect(Object.isFrozen(CHART_DEFINITIONS)).toBe(true);
	});

	it('keeps every definition complete, immutable, and linked to i18n', () => {
		expect(Object.keys(CHART_DEFINITIONS)).toEqual(CHART_TYPE_KEYS);

		for (const key of CHART_TYPE_KEYS) {
			const definition = CHART_DEFINITIONS[key];
			expect(definition.key).toBe(key);
			expect(Object.isFrozen(definition)).toBe(true);
			expect(en).toHaveProperty(`chive-chart-toggle-${key}`);
			expect(en).toHaveProperty(`chive-viz-${key}-desc`);
			expect(en).toHaveProperty(definition.catalogCategoryKey);
		}
	});

	it('keeps default config blocks aligned with supported chart identities', () => {
		const config = createDefaultChartConfig();
		const configChartKeys = Object.keys(config)
			.filter(key => key !== 'activeTab' && key !== 'globalFilter');

		expect(sorted(configChartKeys)).toEqual(sorted(CHART_TYPE_KEYS));
	});

	it('keeps workspace DOM metadata aligned with supported chart identities', () => {
		expect(sorted(Object.keys(CHART_CONTAINERS))).toEqual(sorted(CHART_TYPE_KEYS));
		expect(sorted(Object.keys(CHART_BLOCKS))).toEqual(sorted(CHART_TYPE_KEYS));
	});

	it('keeps user-facing catalog metadata complete and immutable', () => {
		expect(sorted(Object.keys(CHART_CATALOG))).toEqual(sorted(CHART_TYPE_KEYS));
		expect(Object.isFrozen(CHART_CATALOG)).toBe(true);

		for (const type of CHART_TYPE_KEYS) {
			const entry = CHART_CATALOG[type];
			expect(entry.previewSvg).toContain('<svg');
			expect(entry.categoryKey).toMatch(/^chive-viz-category-/);
			expect(Object.isFrozen(entry)).toBe(true);
		}
	});

	it('keeps all integration surfaces complete and canonically ordered', () => {
		expect(SUPPORTED_CONTROL_CHART_TYPES).toEqual(CHART_TYPE_KEYS);
		expect(SUPPORTED_WORKSPACE_CHART_TYPES).toEqual(CHART_TYPE_KEYS);
		expect(SUPPORTED_PANEL_CHART_TYPES).toEqual(CHART_TYPE_KEYS);
	});

	it('keeps the manual ChartTypeKey JSDoc union aligned', () => {
		const source = readFileSync(resolve('src/types.js'), 'utf8');
		const typedef = source.match(/@typedef \{([^}]+)\} ChartTypeKey/);
		expect(typedef).not.toBeNull();

		const documentedKeys = Array.from(
			typedef[1].matchAll(/'([^']+)'/g),
			match => match[1],
		);
		expect(documentedKeys).toEqual(CHART_TYPE_KEYS);
	});
});
