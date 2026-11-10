// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BAR_CONTROLS } from '../../../src/charts/bar/controls/descriptions.js';
import { buildDescribedControls } from '../../../src/charts/shared/controls/describedControls.js';

/**
 * Writer test double. The controls' contract is that they hand the right
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
				sort: 'value-desc',
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

const CONTEXT = {
	baseCategoricalOrAll: ['categoria'],
	categorical: ['categoria'],
	numeric: ['valor', 'peso'],
	allColumns: ['categoria', 'valor', 'peso'],
	dates: [],
	rows: [],
};

describe('barControls measure mode', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('emits measure/value updates and keeps the value column when switching back to count', () => {
		const dataset = createDataset('count', null);
		const writer = createWriter();
		document.body.replaceChildren(...buildDescribedControls(BAR_CONTROLS, { dataset, context: CONTEXT, writer, translate: key => key }));

		const measureSelect = document.getElementById('viz-select-bar-measure');
		const valueSelect = document.getElementById('viz-select-bar-value-column');

		measureSelect.value = 'sum';
		measureSelect.dispatchEvent(new Event('change', { bubbles: true }));
		expect(writer.commit).toHaveBeenLastCalledWith({ measureMode: 'sum', valueColumn: 'valor' });

		dataset.chartConfig.bar.measureMode = 'sum';
		dataset.chartConfig.bar.valueColumn = 'valor';
		valueSelect.value = 'peso';
		valueSelect.dispatchEvent(new Event('change', { bubbles: true }));
		expect(writer.commit).toHaveBeenLastCalledWith({ valueColumn: 'peso' });

		dataset.chartConfig.bar.valueColumn = 'peso';
		measureSelect.value = 'count';
		measureSelect.dispatchEvent(new Event('change', { bubbles: true }));
		expect(writer.commit).toHaveBeenLastCalledWith({ measureMode: 'count', valueColumn: 'peso' });

		dataset.chartConfig.bar.measureMode = 'count';
		measureSelect.value = 'mean';
		measureSelect.dispatchEvent(new Event('change', { bubbles: true }));
		expect(writer.commit).toHaveBeenLastCalledWith({ measureMode: 'mean', valueColumn: 'peso' });

		expect(writer.commit).toHaveBeenCalledTimes(4);
	});
});
