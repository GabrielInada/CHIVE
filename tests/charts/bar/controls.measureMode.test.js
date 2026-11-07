// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn(key => key),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
}));

import { createBarChartControls } from '../../../src/charts/bar/controls/builder.js';
import { setupBarChartControlListeners } from '../../../src/charts/bar/controls/listeners.js';

/**
 * Writer test double. The listeners' contract is that they hand the right
 * patch to the writer; merging it into state, firing onConfigChanged, and
 * live-rendering are the adapter's contract and are covered by
 * tests/features/datasetWorkspace/chartControls/chartConfigAdapter.test.js.
 */
function createWriter() {
	return { commit: vi.fn(), preview: vi.fn() };
}

function createDataset(measureMode = 'count', valueColumn = null) {
	return {
		chartConfig: {
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

	it('emits measure/value updates and keeps the value column when switching back to count', () => {
		const dataset = createDataset('count', null);
		const controls = createBarChartControls(dataset, ['categoria'], ['valor', 'peso']);
		controls.forEach(control => document.body.appendChild(control));

		const writer = createWriter();
		setupBarChartControlListeners(dataset, ['categoria'], ['valor', 'peso'], [], writer);

		const measureSelect = document.getElementById('viz-select-bar-measure');
		const valueSelect = document.getElementById('viz-select-bar-value-column');

		measureSelect.value = 'sum';
		measureSelect.dispatchEvent(new Event('change', { bubbles: true }));
		expect(writer.commit).toHaveBeenCalledWith(expect.objectContaining({
				measureMode: 'sum',
				valueColumn: 'valor',
			}));

		dataset.chartConfig.bar.measureMode = 'sum';
		dataset.chartConfig.bar.valueColumn = 'valor';
		valueSelect.value = 'peso';
		valueSelect.dispatchEvent(new Event('change', { bubbles: true }));
		expect(writer.commit).toHaveBeenCalledWith(expect.objectContaining({
				valueColumn: 'peso',
			}));

		dataset.chartConfig.bar.valueColumn = 'peso';
		measureSelect.value = 'count';
		measureSelect.dispatchEvent(new Event('change', { bubbles: true }));
		expect(writer.commit).toHaveBeenCalledWith(expect.objectContaining({
				measureMode: 'count',
				valueColumn: 'peso',
			}));

		dataset.chartConfig.bar.measureMode = 'count';
		measureSelect.value = 'mean';
		measureSelect.dispatchEvent(new Event('change', { bubbles: true }));
		expect(writer.commit).toHaveBeenLastCalledWith({ measureMode: 'mean', valueColumn: 'peso' });

		expect(writer.commit).toHaveBeenCalledTimes(4);
	});
});
