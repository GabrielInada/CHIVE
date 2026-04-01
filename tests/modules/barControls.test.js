// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn(key => key),
	updateActiveDatasetChartConfig: vi.fn(),
}));

vi.mock('../../src/services/i18nService.js', () => ({
	t: mocks.t,
}));

vi.mock('../../src/modules/stateSync.js', () => ({
	updateActiveDatasetChartConfig: mocks.updateActiveDatasetChartConfig,
}));

import { createBarChartControls, setupBarChartControlListeners } from '../../src/modules/chart-controls/barControls.js';

function createDataset(measureMode = 'count', valueColumn = null) {
	return {
		configGraficos: {
			bar: {
				enabled: true,
				category: 'categoria',
				expanded: true,
				customTitle: '',
				chartHeight: 320,
				sort: 'count-desc',
				topN: 10,
				color: '#d4622a',
				colorMode: 'uniform',
				colorScheme: 'Bold',
				gradientMinColor: '#d4622a',
				gradientMaxColor: '#ffffff',
				manualThresholdPct: 50,
				showXAxisLabel: true,
				showYAxisLabel: true,
				measureMode,
				valueColumn,
			},
		},
	};
}

describe('barControls measure mode', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	it('disables value-column selector in count mode and enables it for sum/mean', () => {
		const controlsCount = createBarChartControls(createDataset('count', null), ['categoria'], ['valor']);
		controlsCount.forEach(control => document.body.appendChild(control));
		const valueSelectCount = document.getElementById('viz-select-bar-value-column');
		expect(valueSelectCount).not.toBeNull();
		expect(valueSelectCount.disabled).toBe(true);

		document.body.innerHTML = '';
		const controlsSum = createBarChartControls(createDataset('sum', 'valor'), ['categoria'], ['valor']);
		controlsSum.forEach(control => document.body.appendChild(control));
		const valueSelectSum = document.getElementById('viz-select-bar-value-column');
		expect(valueSelectSum.disabled).toBe(false);
		expect(valueSelectSum.value).toBe('valor');
	});

	it('emits measure/value updates and clears value column when switching back to count', () => {
		const dataset = createDataset('count', null);
		const controls = createBarChartControls(dataset, ['categoria'], ['valor']);
		controls.forEach(control => document.body.appendChild(control));

		const onConfigChanged = vi.fn();
		setupBarChartControlListeners(dataset, ['categoria'], ['valor'], onConfigChanged);

		const measureSelect = document.getElementById('viz-select-bar-measure');
		const valueSelect = document.getElementById('viz-select-bar-value-column');

		measureSelect.value = 'sum';
		measureSelect.dispatchEvent(new Event('change', { bubbles: true }));
		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledWith({
			bar: expect.objectContaining({
				measureMode: 'sum',
				valueColumn: null,
			}),
		});

		dataset.configGraficos.bar.measureMode = 'sum';
		dataset.configGraficos.bar.valueColumn = null;
		valueSelect.value = 'valor';
		valueSelect.dispatchEvent(new Event('change', { bubbles: true }));
		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledWith({
			bar: expect.objectContaining({
				valueColumn: 'valor',
			}),
		});

		dataset.configGraficos.bar.valueColumn = 'valor';
		measureSelect.value = 'count';
		measureSelect.dispatchEvent(new Event('change', { bubbles: true }));
		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledWith({
			bar: expect.objectContaining({
				measureMode: 'count',
				valueColumn: null,
			}),
		});

		expect(onConfigChanged).toHaveBeenCalledTimes(3);
	});
});
