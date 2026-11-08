// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { getChartControlAdapter } from '../../src/charts/registries/controls.js';
import { buildDescribedControls } from '../../src/charts/shared/controls/describedControls.js';
import { CHART_DEFINITIONS } from '../../src/config/charts/definitions.js';
import { createDefaultChartConfig } from '../../src/config/charts/defaults.js';

vi.mock('../../src/services/i18nService.js', () => ({ t: key => key }));

// Every offered enum must survive canonicalization, including conditional
// selects. A described chart's control carries its own id; scatter, which
// still pairs a builder with listeners, names each select's id suffix here.
const SELECTS = {
	scatter: {
		xScale: 'xscale',
		yScale: 'yscale',
		sizeMode: 'size-mode',
		categoricalPairMode: 'categorical-mode',
		colorMode: 'color-mode',
		gradientDistribution: 'gradient-distribution',
		colorScheme: 'color-scheme',
		'regression.mode': 'regression-mode',
	},
};

function listedSettings(values, prefix = '') {
	return Object.entries(values).flatMap(([key, offered]) => {
		const path = prefix ? `${prefix}.${key}` : key;
		return Array.isArray(offered) ? [[path, offered]] : listedSettings(offered, path);
	});
}

function buildControls(type, overrides = {}) {
	const chartConfig = createDefaultChartConfig();
	chartConfig[type] = { ...chartConfig[type], enabled: true, category: 'group', ...overrides };
	const dataset = {
		rows: [{ group: 'A', x: 1, y: 2, z: 3 }],
		columns: [{ name: 'group', type: 'text' }, ...['x', 'y', 'z'].map(name => ({ name, type: 'number' }))],
		chartConfig,
	};
	const context = {
		allColumns: ['group', 'x', 'y', 'z'],
		numeric: ['x', 'y', 'z'],
		categorical: ['group'],
		baseCategoricalOrAll: ['group'],
		dates: [],
	};
	const adapter = getChartControlAdapter(type);
	const root = document.createElement('div');
	root.append(...(adapter.controls
		? buildDescribedControls(adapter.controls, { dataset, context, writer: { commit() {}, preview() {} }, translate: key => key })
		: adapter.build(dataset, context)));
	return root;
}

/** The control a described chart declares for `setting`. */
function describedControl(controls, setting) {
	return controls.sections.flatMap(section => section.controls).find(control => control.key === setting);
}

function offeredBy(root, type, setting) {
	const { controls } = getChartControlAdapter(type);
	if (controls) {
		const control = describedControl(controls, setting);
		expect(control, `${type}.${setting} needs a declared control`).toBeDefined();
		// A palette, described or written by hand, names its buttons by its id.
		const presets = root.querySelectorAll(`[data-color-preset-control="${control.id}"]`);
		if (presets.length > 0) return Array.from(presets, button => button.dataset.presetName);
		const select = root.querySelector(`#${control.id}`);
		expect(select, `${type}.${setting} is not shown by default`).not.toBeNull();
		return Array.from(select.options, option => option.value);
	}
	const suffix = SELECTS[type]?.[setting];
	expect(suffix, `${type}.${setting} needs a control assertion`).toBeDefined();
	const select = root.querySelector(`#viz-select-${type}-${suffix}`);
	expect(select).not.toBeNull();
	return Array.from(select.options, option => option.value);
}

describe('enumerated chart controls', () => {
	for (const { key: type, allowedValues } of Object.values(CHART_DEFINITIONS)) {
		for (const [setting, offered] of listedSettings(allowedValues)) {
			it(`${type}.${setting} offers exactly the values its definition accepts`, () => {
				const colorMode = type === 'bar' ? 'gradient' : setting === 'colorScheme' ? 'category' : 'numeric';
				const root = buildControls(type, ['bar', 'scatter'].includes(type) ? { colorMode } : {});
				expect(offeredBy(root, type, setting)).toEqual(offered);
			});
		}
	}
});
