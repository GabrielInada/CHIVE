// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn(key => key),
	updateActiveDatasetConfig: vi.fn(),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
}));

vi.mock('../../../src/modules/state/appState.js', async (importOriginal) => ({
	...(await importOriginal()),
	updateActiveDatasetConfig: mocks.updateActiveDatasetConfig,
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
		chartConfig: {
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

function selectValue(id, value) {
	const select = document.getElementById(id);
	if (![...select.options].some(option => option.value === value)) {
		const option = document.createElement('option');
		option.value = value;
		select.appendChild(option);
	}
	select.value = value;
	select.dispatchEvent(new Event('change', { bubbles: true }));
}

function lastConfig() {
	return mocks.updateActiveDatasetConfig.mock.calls.at(-1)[0].treemap;
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

	it('renders fallback values and disabled controls for invalid config', () => {
		const dataset = createDataset({
			enabled: false,
			measureMode: 'invalid',
			valueColumn: 'old',
			padding: 0,
			colorMode: '',
			colorScheme: '',
		});
		const controls = createTreeMapControls(dataset, ['region'], ['sales'], []);
		appendControls(controls);

		expect(document.getElementById('viz-select-treemap-measure').value).toBe('count');
		expect(document.getElementById('viz-select-treemap-value-column').value).toBe('');
		expect(document.getElementById('viz-slider-treemap-padding').value).toBe('2');
		expect(document.getElementById('viz-select-treemap-color-mode').value).toBe('scheme');
		expect(document.getElementById('viz-select-treemap-category').disabled).toBe(true);
		expect(document.querySelector('button[data-color-preset-control="viz-treemap-color-preset"][data-preset-name="Bold"]').disabled).toBe(true);
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

		expect(mocks.updateActiveDatasetConfig).toHaveBeenCalledWith({
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

		expect(mocks.updateActiveDatasetConfig).toHaveBeenCalledWith({
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

		expect(mocks.updateActiveDatasetConfig).toHaveBeenCalledWith({
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

		expect(mocks.updateActiveDatasetConfig).toHaveBeenCalledTimes(1);
		const call = mocks.updateActiveDatasetConfig.mock.calls[0][0];
		expect(call.treemap.colorScheme).toBe('Bold');
		expect(call.treemap.color).toMatch(/^#[0-9a-fA-F]{6}$/);
	});

	it('skips listener setup when controls are absent', () => {
		const dataset = createDataset();

		expect(() => setupTreeMapControlListeners(dataset, ['region'], ['sales'], vi.fn())).not.toThrow();
		expect(mocks.updateActiveDatasetConfig).not.toHaveBeenCalled();
	});

	it('commits category, value, title, padding, and toggle changes', () => {
		const dataset = createDataset({ measureMode: 'sum', valueColumn: 'sales' });
		const controls = createTreeMapControls(dataset, ['region'], ['sales'], []);
		appendControls(controls);

		const onConfigChanged = vi.fn();
		setupTreeMapControlListeners(dataset, ['region'], ['sales'], [], onConfigChanged);

		selectValue('viz-select-treemap-category', '');
		expect(lastConfig().category).toBeNull();

		selectValue('viz-select-treemap-value-column', 'old');
		expect(lastConfig().valueColumn).toBeNull();

		const title = document.getElementById('viz-input-treemap-title');
		title.value = '  Custom treemap  ';
		title.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig().customTitle).toBe('Custom treemap');

		const padding = document.getElementById('viz-slider-treemap-padding');
		padding.value = '5';
		padding.dispatchEvent(new Event('input', { bubbles: true }));
		expect(padding.parentElement.querySelector('output').textContent).toBe('5');
		padding.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig().padding).toBe(5);

		const labels = document.getElementById('viz-toggle-treemap-labels');
		labels.checked = false;
		labels.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig().showLabels).toBe(false);

		const values = document.getElementById('viz-toggle-treemap-values');
		values.checked = true;
		values.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig().showValues).toBe(true);

		expect(onConfigChanged).toHaveBeenCalledTimes(6);
	});

	it('coerces measure and color-mode selections through fallback branches', () => {
		const dataset = createDataset({ measureMode: 'sum', valueColumn: 'old' });
		const controls = createTreeMapControls(dataset, ['region'], ['sales'], []);
		appendControls(controls);

		setupTreeMapControlListeners(dataset, ['region'], ['sales'], [], vi.fn());

		selectValue('viz-select-treemap-measure', 'invalid');
		expect(lastConfig()).toEqual(expect.objectContaining({ measureMode: 'count', valueColumn: null }));

		dataset.chartConfig.treemap.valueColumn = 'old';
		selectValue('viz-select-treemap-measure', 'sum');
		expect(lastConfig()).toEqual(expect.objectContaining({ measureMode: 'sum', valueColumn: null }));

		selectValue('viz-select-treemap-color-mode', 'uniform');
		expect(lastConfig().colorMode).toBe('uniform');

		selectValue('viz-select-treemap-color-mode', 'unexpected');
		expect(lastConfig().colorMode).toBe('scheme');
	});

	it('ignores unknown color presets', () => {
		const dataset = createDataset();
		const controls = createTreeMapControls(dataset, ['region'], ['sales'], []);
		appendControls(controls);
		const missing = document.createElement('button');
		missing.dataset.colorPresetControl = 'viz-treemap-color-preset';
		missing.dataset.presetName = 'Missing';
		document.body.appendChild(missing);

		setupTreeMapControlListeners(dataset, ['region'], ['sales'], [], vi.fn());
		missing.click();

		expect(mocks.updateActiveDatasetConfig).not.toHaveBeenCalled();
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
