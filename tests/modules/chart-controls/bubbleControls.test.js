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

function createDataset(measureMode = 'count', valueColumn = null, nestingMode = 'flat', nestingColumns = []) {
	return {
		dados: [
			{ categoria: 'A', valor: 10, grupo: 'X', regiao: 'Norte' },
			{ categoria: 'B', valor: 20, grupo: 'Y', regiao: 'Sul' },
		],
		configGraficos: {
			bubble: {
				enabled: true,
				expanded: true,
				category: 'categoria',
				groupColumn: nestingColumns.length > 0 ? nestingColumns[0] : 'grupo',
				nestingColumns,
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
});

describe('bubbleControls progressive nesting selectors', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	it('grouped mode shows level 1 selector', () => {
		const dataset = createDataset('count', null, 'grouped', []);
		const controls = createBubbleChartControls(dataset, ['categoria'], ['valor'], ['categoria', 'grupo', 'regiao']);
		controls.forEach(control => document.body.appendChild(control));

		const level0 = document.getElementById('viz-select-bubble-nesting-level-0');
		expect(level0).not.toBeNull();
		expect(level0.disabled).toBe(false);
	});

	it('selecting level 1 reveals level 2', () => {
		const dataset = createDataset('count', null, 'grouped', ['grupo']);
		const controls = createBubbleChartControls(dataset, ['categoria'], ['valor'], ['categoria', 'grupo', 'regiao']);
		controls.forEach(control => document.body.appendChild(control));

		const level0 = document.getElementById('viz-select-bubble-nesting-level-0');
		const level1 = document.getElementById('viz-select-bubble-nesting-level-1');

		expect(level0).not.toBeNull();
		expect(level0.value).toBe('grupo');
		expect(level1).not.toBeNull();
	});

	it('selecting level 2 reveals level 3', () => {
		const dataset = createDataset('count', null, 'grouped', ['grupo', 'regiao']);
		const controls = createBubbleChartControls(dataset, ['categoria'], ['valor'], ['categoria', 'grupo', 'regiao', 'estado']);
		controls.forEach(control => document.body.appendChild(control));

		const level0 = document.getElementById('viz-select-bubble-nesting-level-0');
		const level1 = document.getElementById('viz-select-bubble-nesting-level-1');
		const level2 = document.getElementById('viz-select-bubble-nesting-level-2');

		expect(level0.value).toBe('grupo');
		expect(level1.value).toBe('regiao');
		expect(level2).not.toBeNull();
	});

	it('options exclude already selected columns and current category column', () => {
		const dataset = createDataset('count', null, 'grouped', ['grupo']);
		const controls = createBubbleChartControls(dataset, ['categoria'], ['valor'], ['categoria', 'grupo', 'regiao']);
		controls.forEach(control => document.body.appendChild(control));

		const level1 = document.getElementById('viz-select-bubble-nesting-level-1');
		const optionValues = Array.from(level1.options).map(o => o.value);

		// Should NOT include 'grupo' (already selected at level 0) or 'categoria' (is category column)
		expect(optionValues).not.toContain('grupo');
		expect(optionValues).not.toContain('categoria');
		// Should include 'regiao'
		expect(optionValues).toContain('regiao');
	});

	it('clearing level K truncates deeper levels in config updates', () => {
		const dataset = createDataset('count', null, 'grouped', ['grupo', 'regiao']);
		const controls = createBubbleChartControls(dataset, ['categoria'], ['valor'], ['categoria', 'grupo', 'regiao', 'estado']);
		controls.forEach(control => document.body.appendChild(control));

		const onConfigChanged = vi.fn();
		setupBubbleChartControlListeners(dataset, ['categoria'], ['valor'], ['categoria', 'grupo', 'regiao', 'estado'], onConfigChanged);

		// Clear level 0 → should truncate all
		const level0 = document.getElementById('viz-select-bubble-nesting-level-0');
		level0.value = '';
		level0.dispatchEvent(new Event('change', { bubbles: true }));

		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledWith({
			bubble: expect.objectContaining({
				nestingColumns: [],
				groupColumn: null,
			}),
		});
		expect(onConfigChanged).toHaveBeenCalledTimes(1);
	});

	it('flat mode nesting selectors are disabled', () => {
		const dataset = createDataset('count', null, 'flat', []);
		const controls = createBubbleChartControls(dataset, ['categoria'], ['valor'], ['categoria', 'grupo', 'regiao']);
		controls.forEach(control => document.body.appendChild(control));

		const level0 = document.getElementById('viz-select-bubble-nesting-level-0');
		expect(level0).not.toBeNull();
		expect(level0.disabled).toBe(true);
	});

	it('initial config with groupColumn hydrates first nesting level selector correctly', () => {
		// Simulate old config with only groupColumn, no nestingColumns
		const dataset = createDataset('count', null, 'grouped', []);
		dataset.configGraficos.bubble.groupColumn = 'grupo';
		dataset.configGraficos.bubble.nestingColumns = [];

		const controls = createBubbleChartControls(dataset, ['categoria'], ['valor'], ['categoria', 'grupo', 'regiao']);
		controls.forEach(control => document.body.appendChild(control));

		// The migration in createNestingControls should pick up groupColumn
		const level0 = document.getElementById('viz-select-bubble-nesting-level-0');
		expect(level0).not.toBeNull();
		expect(level0.value).toBe('grupo');
	});
});
