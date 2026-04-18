// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn(key => key),
	updateActiveDatasetChartConfig: vi.fn(),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
}));

vi.mock('../../../src/modules/stateSync.js', () => ({
	updateActiveDatasetChartConfig: mocks.updateActiveDatasetChartConfig,
}));

import { createBubbleChartControls, setupBubbleChartControlListeners } from '../../../src/modules/chart-controls/bubbleControls.js';

function createDataset(measureMode = 'count', valueColumn = null, nestingMode = 'flat') {
	return {
		dados: [
			{ categoria: 'A', valor: 10, grupo: 'X' },
			{ categoria: 'B', valor: 20, grupo: 'Y' },
		],
		configGraficos: {
			bubble: {
				enabled: true,
				expanded: true,
				category: 'categoria',
				groupColumn: 'grupo',
				customTitle: '',
				chartHeight: 700,
				topN: 10,
				measureMode,
				valueColumn,
				padding: 3,
				labelMode: 'auto',
				nestingMode,
				colorScheme: 'Tableau10',
				filter: {
					column: null,
					mode: 'categorical',
					include: [],
					operator: 'between',
				},
			},
		},
	};
}

describe('bubbleControls measure mode', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	it('disables value-column selector in count mode and enables it for sum/mean', () => {
		const controls = createBubbleChartControls(createDataset('count', null), ['categoria'], ['valor'], ['categoria', 'grupo']);
		controls.forEach(control => document.body.appendChild(control));
		const valueSelect = document.getElementById('viz-select-bubble-value-column');
		expect(valueSelect.disabled).toBe(true);

		document.body.innerHTML = '';
		const sumControls = createBubbleChartControls(createDataset('sum', 'valor'), ['categoria'], ['valor'], ['categoria', 'grupo']);
		sumControls.forEach(control => document.body.appendChild(control));
		expect(document.getElementById('viz-select-bubble-value-column').disabled).toBe(false);
	});

	it('emits measure/value updates and clears value column when switching back to count', () => {
		const dataset = createDataset('count', null);
		const controls = createBubbleChartControls(dataset, ['categoria'], ['valor'], ['categoria', 'grupo']);
		controls.forEach(control => document.body.appendChild(control));

		const onConfigChanged = vi.fn();
		setupBubbleChartControlListeners(dataset, ['categoria'], ['valor'], ['categoria', 'grupo'], onConfigChanged);

		const measureSelect = document.getElementById('viz-select-bubble-measure');
		const valueSelect = document.getElementById('viz-select-bubble-value-column');

		measureSelect.value = 'sum';
		measureSelect.dispatchEvent(new Event('change', { bubbles: true }));
		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledWith({
			bubble: expect.objectContaining({
				measureMode: 'sum',
				valueColumn: 'valor',
			}),
		});

		dataset.configGraficos.bubble.measureMode = 'sum';
		dataset.configGraficos.bubble.valueColumn = 'valor';
		valueSelect.value = 'valor';
		valueSelect.dispatchEvent(new Event('change', { bubbles: true }));
		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledWith({
			bubble: expect.objectContaining({
				valueColumn: 'valor',
			}),
		});

		dataset.configGraficos.bubble.valueColumn = 'valor';
		measureSelect.value = 'count';
		measureSelect.dispatchEvent(new Event('change', { bubbles: true }));
		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledWith({
			bubble: expect.objectContaining({
				measureMode: 'count',
				valueColumn: null,
			}),
		});

		expect(onConfigChanged).toHaveBeenCalledTimes(3);
	});
});

describe('bubbleControls nesting mode', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	it('nesting mode control exists and defaults to flat', () => {
		const controls = createBubbleChartControls(createDataset('count', null, 'flat'), ['categoria'], ['valor'], ['categoria', 'grupo']);
		controls.forEach(control => document.body.appendChild(control));

		const nestingSelect = document.getElementById('viz-select-bubble-nesting-mode');
		expect(nestingSelect).not.toBeNull();
		expect(nestingSelect.value).toBe('flat');
	});

	it('nesting mode control updates config when changed', () => {
		const dataset = createDataset('count', null, 'flat');
		const controls = createBubbleChartControls(dataset, ['categoria'], ['valor'], ['categoria', 'grupo']);
		controls.forEach(control => document.body.appendChild(control));

		const onConfigChanged = vi.fn();
		setupBubbleChartControlListeners(dataset, ['categoria'], ['valor'], ['categoria', 'grupo'], onConfigChanged);

		const nestingSelect = document.getElementById('viz-select-bubble-nesting-mode');
		nestingSelect.value = 'grouped';
		nestingSelect.dispatchEvent(new Event('change', { bubbles: true }));

		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledWith({
			bubble: expect.objectContaining({
				nestingMode: 'grouped',
			}),
		});
		expect(onConfigChanged).toHaveBeenCalledTimes(1);
	});

	it('group column control still updates config', () => {
		const dataset = createDataset('count', null, 'grouped');
		const controls = createBubbleChartControls(dataset, ['categoria'], ['valor'], ['categoria', 'grupo']);
		controls.forEach(control => document.body.appendChild(control));

		const onConfigChanged = vi.fn();
		setupBubbleChartControlListeners(dataset, ['categoria'], ['valor'], ['categoria', 'grupo'], onConfigChanged);

		const groupSelect = document.getElementById('viz-select-bubble-group-column');
		groupSelect.value = 'categoria';
		groupSelect.dispatchEvent(new Event('change', { bubbles: true }));

		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledWith({
			bubble: expect.objectContaining({
				groupColumn: 'categoria',
			}),
		});
		expect(onConfigChanged).toHaveBeenCalledTimes(1);
	});
});
