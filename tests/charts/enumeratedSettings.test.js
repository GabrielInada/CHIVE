// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { getChartControlAdapter } from '../../src/charts/registries/controls.js';
import { CHART_DEFINITIONS } from '../../src/config/charts/definitions.js';
import { createDefaultChartConfig } from '../../src/config/charts/defaults.js';

vi.mock('../../src/services/i18nService.js', () => ({ t: key => key }));

// IDs are the public contract between each builder and its listeners. Every
// offered enum must survive canonicalization, including conditional selects.
const SELECTS = {
	bar: { sort: 'sort', measureMode: 'measure', colorMode: 'color-mode', gradientDistribution: 'gradient-distribution' },
	bubble: { measureMode: 'measure', labelMode: 'label-mode', nestingMode: 'nesting-mode' },
	line: { curve: 'curve', missingMode: 'missing', aggregateMode: 'aggregate' },
	network: { edgeColorMode: 'edge-color-mode' },
	pie: { measureMode: 'measure', topNMode: 'topn-mode', labelPosition: 'label-position' },
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
	tin: { fillMode: 'fill-mode', colorRamp: 'color-ramp', gradientDistribution: 'gradient-distribution', isolineMode: 'isoline-mode' },
	treemap: { measureMode: 'measure', colorMode: 'color-mode' },
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
	const root = document.createElement('div');
	root.append(...getChartControlAdapter(type).build(dataset, context));
	return root;
}

describe('enumerated chart controls', () => {
	for (const { key: type, allowedValues } of Object.values(CHART_DEFINITIONS)) {
		for (const [setting, offered] of listedSettings(allowedValues)) {
			it(`${type}.${setting} offers exactly the values its definition accepts`, () => {
				const colorMode = type === 'bar' ? 'gradient' : setting === 'colorScheme' ? 'category' : 'numeric';
				const root = buildControls(type, ['bar', 'scatter'].includes(type) ? { colorMode } : {});
				if (setting === 'colorScheme' && type !== 'scatter') {
					const buttons = root.querySelectorAll(`[data-color-preset-control="viz-${type}-color-preset"]`);
					expect(Array.from(buttons, button => button.dataset.presetName)).toEqual(offered);
				} else {
					const suffix = SELECTS[type]?.[setting];
					expect(suffix, `${type}.${setting} needs a control assertion`).toBeDefined();
					const select = root.querySelector(`#viz-select-${type}-${suffix}`);
					expect(select).not.toBeNull();
					expect(Array.from(select.options, option => option.value)).toEqual(offered);
				}
			});
		}
	}
});
