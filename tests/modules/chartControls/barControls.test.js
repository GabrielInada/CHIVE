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
	createBarChartControls,
	setupBarChartControlListeners,
	computeDefaults,
} from '../../../src/modules/chartControls/barControls.js';

function createDataset(overrides = {}) {
	return {
		chartConfig: {
			bar: {
				enabled: true,
				expanded: true,
				category: 'region',
				measureMode: 'count',
				valueColumn: null,
				sort: 'count-desc',
				topN: 0,
				customTitle: '',
				chartHeight: 320,
				showXAxisLabel: true,
				showYAxisLabel: true,
				colorMode: 'uniform',
				color: '#4e79a7',
				colorScheme: 'Bold',
				gradientMinColor: '#4e79a7',
				gradientMaxColor: '#ffffff',
				gradientDistribution: 'value',
				manualThresholdPct: 50,
				...overrides,
			},
		},
	};
}

function appendControls(controls) {
	controls.forEach(control => document.body.appendChild(control));
}

describe('barControls UI structure', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	it('offers categorical columns plus an empty (none) option in the category select', () => {
		const dataset = createDataset();
		const controls = createBarChartControls(dataset, ['region', 'team'], ['sales'], ['region', 'team', 'sales']);
		appendControls(controls);

		const values = Array.from(document.getElementById('viz-select-bar').options).map(o => o.value);
		expect(values).toEqual(['', 'region', 'team']);
	});

	it('disables the value-column select when measureMode is count', () => {
		const countDataset = createDataset({ measureMode: 'count' });
		const countControls = createBarChartControls(countDataset, ['region'], ['sales'], ['region', 'sales']);
		appendControls(countControls);
		expect(document.getElementById('viz-select-bar-value-column').disabled).toBe(true);

		document.body.innerHTML = '';
		const sumDataset = createDataset({ measureMode: 'sum' });
		const sumControls = createBarChartControls(sumDataset, ['region'], ['sales'], ['region', 'sales']);
		appendControls(sumControls);
		expect(document.getElementById('viz-select-bar-value-column').disabled).toBe(false);
	});

	it('disables the gradient color pickers when colorMode is uniform', () => {
		const uniformDataset = createDataset({ colorMode: 'uniform' });
		const uniformControls = createBarChartControls(uniformDataset, ['region'], ['sales'], ['region', 'sales']);
		appendControls(uniformControls);
		expect(document.getElementById('viz-input-bar-gradient-min').disabled).toBe(true);
		expect(document.getElementById('viz-input-bar-gradient-max').disabled).toBe(true);

		document.body.innerHTML = '';
		const gradientDataset = createDataset({ colorMode: 'gradient' });
		const gradientControls = createBarChartControls(gradientDataset, ['region'], ['sales'], ['region', 'sales']);
		appendControls(gradientControls);
		expect(document.getElementById('viz-input-bar-gradient-min').disabled).toBe(false);
		expect(document.getElementById('viz-input-bar-gradient-max').disabled).toBe(false);
	});

	it('renders the gradient-distribution sub-toggle only for colorMode=gradient', () => {
		const cases = [
			{ mode: 'uniform', expectPresent: false },
			{ mode: 'gradient', expectPresent: true },
			{ mode: 'gradient-manual', expectPresent: false },
		];
		cases.forEach(({ mode, expectPresent }) => {
			document.body.innerHTML = '';
			const dataset = createDataset({ colorMode: mode });
			const controls = createBarChartControls(dataset, ['region'], ['sales'], ['region', 'sales']);
			appendControls(controls);
			const element = document.getElementById('viz-select-bar-gradient-distribution');
			if (expectPresent) {
				expect(element).not.toBeNull();
			} else {
				expect(element).toBeNull();
			}
		});
	});

	it('renders the manual-threshold slider only for colorMode=gradient-manual', () => {
		const cases = [
			{ mode: 'uniform', expectPresent: false },
			{ mode: 'gradient', expectPresent: false },
			{ mode: 'gradient-manual', expectPresent: true },
		];
		cases.forEach(({ mode, expectPresent }) => {
			document.body.innerHTML = '';
			const dataset = createDataset({ colorMode: mode });
			const controls = createBarChartControls(dataset, ['region'], ['sales'], ['region', 'sales']);
			appendControls(controls);
			const element = document.getElementById('viz-slider-bar-threshold');
			if (expectPresent) {
				expect(element).not.toBeNull();
			} else {
				expect(element).toBeNull();
			}
		});
	});
});

describe('barControls listeners', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	it('commits a measureMode change through the facade and switches valueColumn defaults', () => {
		// count → sum: preserves a valid valueColumn
		const dataset = createDataset({ measureMode: 'count', valueColumn: 'sales' });
		const controls = createBarChartControls(dataset, ['region'], ['sales'], ['region', 'sales']);
		appendControls(controls);

		const onConfigChanged = vi.fn();
		setupBarChartControlListeners(dataset, dataset.chartConfig.bar, ['sales'], ['region', 'sales'], onConfigChanged);

		const measureSelect = document.getElementById('viz-select-bar-measure');
		measureSelect.value = 'sum';
		measureSelect.dispatchEvent(new Event('change', { bubbles: true }));

		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledWith({
			bar: expect.objectContaining({ measureMode: 'sum', valueColumn: 'sales' }),
		});
		expect(onConfigChanged).toHaveBeenCalledTimes(1);
	});

	it('nulls valueColumn when measureMode switches to count', () => {
		const dataset = createDataset({ measureMode: 'sum', valueColumn: 'sales' });
		const controls = createBarChartControls(dataset, ['region'], ['sales'], ['region', 'sales']);
		appendControls(controls);

		setupBarChartControlListeners(dataset, dataset.chartConfig.bar, ['sales'], ['region', 'sales'], vi.fn());

		const measureSelect = document.getElementById('viz-select-bar-measure');
		measureSelect.value = 'count';
		measureSelect.dispatchEvent(new Event('change', { bubbles: true }));

		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledWith({
			bar: expect.objectContaining({ measureMode: 'count', valueColumn: null }),
		});
	});

	it('coerces an unknown color mode to uniform', () => {
		const dataset = createDataset({ colorMode: 'uniform' });
		const controls = createBarChartControls(dataset, ['region'], ['sales'], ['region', 'sales']);
		appendControls(controls);

		setupBarChartControlListeners(dataset, dataset.chartConfig.bar, ['sales'], ['region', 'sales'], vi.fn());

		const select = document.getElementById('viz-select-bar-color-mode');
		// jsdom select rejects values not in the option set, so add a sentinel option first.
		const opt = document.createElement('option');
		opt.value = 'gibberish';
		select.appendChild(opt);
		select.value = 'gibberish';
		select.dispatchEvent(new Event('change', { bubbles: true }));

		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledWith({
			bar: expect.objectContaining({ colorMode: 'uniform' }),
		});
	});

	it('rejects value-column values not in numericOptions', () => {
		const dataset = createDataset({ measureMode: 'sum', valueColumn: 'sales' });
		const controls = createBarChartControls(dataset, ['region'], ['sales'], ['region', 'sales']);
		appendControls(controls);

		setupBarChartControlListeners(dataset, dataset.chartConfig.bar, ['sales'], ['region', 'sales'], vi.fn());

		const valueColumnSelect = document.getElementById('viz-select-bar-value-column');
		valueColumnSelect.value = '';
		valueColumnSelect.dispatchEvent(new Event('change', { bubbles: true }));

		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledWith({
			bar: expect.objectContaining({ valueColumn: null }),
		});
	});

	it('transforms Top N from string to number', () => {
		const dataset = createDataset({ topN: 0 });
		const controls = createBarChartControls(dataset, ['region'], ['sales'], ['region', 'sales']);
		appendControls(controls);

		setupBarChartControlListeners(dataset, dataset.chartConfig.bar, ['sales'], ['region', 'sales'], vi.fn());

		const topnSelect = document.getElementById('viz-select-bar-topn');
		topnSelect.value = '20';
		topnSelect.dispatchEvent(new Event('change', { bubbles: true }));

		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledTimes(1);
		const call = mocks.updateActiveDatasetChartConfig.mock.calls[0][0];
		expect(call.bar.topN).toBe(20);
		expect(typeof call.bar.topN).toBe('number');
	});

	it('toggles the X-axis label checkbox through the facade', () => {
		const dataset = createDataset({ showXAxisLabel: true });
		const controls = createBarChartControls(dataset, ['region'], ['sales'], ['region', 'sales']);
		appendControls(controls);

		setupBarChartControlListeners(dataset, dataset.chartConfig.bar, ['sales'], ['region', 'sales'], vi.fn());

		const checkbox = document.getElementById('viz-toggle-bar-x-label');
		checkbox.checked = false;
		checkbox.dispatchEvent(new Event('change', { bubbles: true }));

		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledWith({
			bar: expect.objectContaining({ showXAxisLabel: false }),
		});
	});
});

describe('barControls computeDefaults', () => {
	it('preserves the current category when it is still in scope', () => {
		const dataset = createDataset({ category: 'region' });
		const ctx = { baseCategoricalOrAll: ['region', 'team'] };
		expect(computeDefaults(dataset, ctx)).toEqual({ category: 'region' });
	});

	it('falls back to the first option when the current value is out of scope', () => {
		const dataset = createDataset({ category: 'old' });
		const ctx = { baseCategoricalOrAll: ['region', 'team'] };
		expect(computeDefaults(dataset, ctx)).toEqual({ category: 'region' });
	});

	it('returns null when there are no candidate categorical columns', () => {
		const dataset = createDataset();
		const ctx = { baseCategoricalOrAll: [] };
		expect(computeDefaults(dataset, ctx)).toEqual({ category: null });
	});
});
