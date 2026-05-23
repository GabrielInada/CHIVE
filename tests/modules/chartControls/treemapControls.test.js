// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn(key => key),
	updateActiveDatasetChartConfig: vi.fn(),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
}));

vi.mock('../../../src/modules/state/stateSync.js', () => ({
	updateActiveDatasetChartConfig: mocks.updateActiveDatasetChartConfig,
}));

vi.mock('../../../src/modules/chartControls/livePreview.js', () => ({
	triggerLiveRender: vi.fn(),
}));

import {
	createTreeMapControls,
	setupTreeMapControlListeners,
	computeDefaults,
} from '../../../src/modules/chartControls/treemapControls.js';

function createDataset(overrides = {}) {
	return {
		configGraficos: {
			treemap: {
				enabled: true,
				expanded: true,
				category: 'region',
				measureMode: 'count',
				valueColumn: null,
				topN: 0,
				customTitle: '',
				chartHeight: 380,
				padding: 2,
				showLabels: true,
				showValues: false,
				colorMode: 'scheme',
				color: '#4e79a7',
				colorScheme: 'Bold',
				...overrides,
			},
		},
	};
}

function appendControls(controls) {
	controls.forEach(control => document.body.appendChild(control));
}

describe('treemapControls UI structure', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	it('prepends a none option to the category select', () => {
		const dataset = createDataset();
		const controls = createTreeMapControls(dataset, ['region', 'team'], ['sales'], ['region', 'team', 'sales']);
		appendControls(controls);

		const values = Array.from(document.getElementById('viz-select-treemap-category').options).map(o => o.value);
		expect(values).toEqual(['', 'region', 'team']);
	});

	it('disables the value-column select when measureMode is count', () => {
		const dataset = createDataset({ measureMode: 'count' });
		const controls = createTreeMapControls(dataset, ['region'], ['sales'], []);
		appendControls(controls);
		expect(document.getElementById('viz-select-treemap-value-column').disabled).toBe(true);

		document.body.innerHTML = '';
		const sumDataset = createDataset({ measureMode: 'sum', valueColumn: 'sales' });
		const sumControls = createTreeMapControls(sumDataset, ['region'], ['sales'], []);
		appendControls(sumControls);
		expect(document.getElementById('viz-select-treemap-value-column').disabled).toBe(false);
	});

	it('disables the uniform-color input when colorMode is scheme', () => {
		const schemeDataset = createDataset({ colorMode: 'scheme' });
		const schemeControls = createTreeMapControls(schemeDataset, ['region'], ['sales'], []);
		appendControls(schemeControls);
		expect(document.getElementById('viz-input-treemap-color').disabled).toBe(true);

		document.body.innerHTML = '';
		const uniformDataset = createDataset({ colorMode: 'uniform' });
		const uniformControls = createTreeMapControls(uniformDataset, ['region'], ['sales'], []);
		appendControls(uniformControls);
		expect(document.getElementById('viz-input-treemap-color').disabled).toBe(false);
	});
});

describe('treemapControls listeners', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	it('clears valueColumn when measure flips back to count', () => {
		const dataset = createDataset({ measureMode: 'sum', valueColumn: 'sales' });
		const controls = createTreeMapControls(dataset, ['region'], ['sales'], []);
		appendControls(controls);

		const onConfigChanged = vi.fn();
		setupTreeMapControlListeners(dataset, ['region'], ['sales'], [], onConfigChanged);

		const measure = document.getElementById('viz-select-treemap-measure');
		measure.value = 'count';
		measure.dispatchEvent(new Event('change', { bubbles: true }));

		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledWith({
			treemap: expect.objectContaining({ measureMode: 'count', valueColumn: null }),
		});
		expect(onConfigChanged).toHaveBeenCalledTimes(1);
	});

	it('keeps a valid valueColumn when measure switches to sum', () => {
		const dataset = createDataset({ measureMode: 'count', valueColumn: 'sales' });
		const controls = createTreeMapControls(dataset, ['region'], ['sales'], []);
		appendControls(controls);

		setupTreeMapControlListeners(dataset, ['region'], ['sales'], [], vi.fn());

		const measure = document.getElementById('viz-select-treemap-measure');
		measure.value = 'sum';
		measure.dispatchEvent(new Event('change', { bubbles: true }));

		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledWith({
			treemap: expect.objectContaining({ measureMode: 'sum', valueColumn: 'sales' }),
		});
	});

	it('commits topN change with a coerced number value', () => {
		const dataset = createDataset();
		const controls = createTreeMapControls(dataset, ['region'], ['sales'], []);
		appendControls(controls);

		setupTreeMapControlListeners(dataset, ['region'], ['sales'], [], vi.fn());

		const select = document.getElementById('viz-select-treemap-topn');
		select.value = '20';
		select.dispatchEvent(new Event('change', { bubbles: true }));

		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledWith({
			treemap: expect.objectContaining({ topN: 20 }),
		});
	});

	it('color preset button commits both colorScheme and the first palette color', () => {
		const dataset = createDataset();
		const controls = createTreeMapControls(dataset, ['region'], ['sales'], []);
		appendControls(controls);

		setupTreeMapControlListeners(dataset, ['region'], ['sales'], [], vi.fn());

		const bold = document.querySelector('button[data-color-preset-control="viz-treemap-color-preset"][data-preset-name="Bold"]');
		expect(bold).not.toBeNull();
		bold.click();

		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledTimes(1);
		const call = mocks.updateActiveDatasetChartConfig.mock.calls[0][0];
		expect(call.treemap.colorScheme).toBe('Bold');
		expect(call.treemap.color).toMatch(/^#[0-9a-fA-F]{6}$/);
	});
});

describe('treemapControls computeDefaults', () => {
	it('preserves the current category when still in scope', () => {
		const dataset = createDataset({ category: 'region' });
		expect(computeDefaults(dataset, { baseCategoricalOrAll: ['region', 'team'] })).toEqual({ category: 'region' });
	});

	it('falls back to the first option when the current category is gone', () => {
		const dataset = createDataset({ category: 'gone' });
		expect(computeDefaults(dataset, { baseCategoricalOrAll: ['region', 'team'] })).toEqual({ category: 'region' });
	});

	it('returns null when no categorical columns are available', () => {
		const dataset = createDataset();
		expect(computeDefaults(dataset, { baseCategoricalOrAll: [] })).toEqual({ category: null });
	});
});
