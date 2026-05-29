// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn(key => key),
	updateActiveDatasetChartConfig: vi.fn(),
	normalizeActiveDatasetConfig: vi.fn(),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
}));

vi.mock('../../../src/modules/state/stateSync.js', () => ({
	updateActiveDatasetChartConfig: mocks.updateActiveDatasetChartConfig,
}));

vi.mock('../../../src/modules/state/appState.js', () => ({
	normalizeActiveDatasetConfig: mocks.normalizeActiveDatasetConfig,
}));

vi.mock('../../../src/modules/chartControls/livePreview.js', () => ({
	triggerLiveRender: vi.fn(),
}));

import {
	createPieChartControls,
	setupPieChartControlListeners,
	computeDefaults,
} from '../../../src/modules/chartControls/pieControls.js';

function createDataset(overrides = {}) {
	return {
		rows: [
			{ region: 'North', sales: 10 },
			{ region: 'North', sales: 15 },
			{ region: 'South', sales: 20 },
			{ region: 'East', sales: 5 },
		],
		chartConfig: {
			pie: {
				enabled: true,
				expanded: true,
				category: 'region',
				valueColumn: 'sales',
				measureMode: 'count',
				topN: 0,
				topNMode: 'other',
				innerRadius: 0,
				outerRadius: 180,
				padAngle: 0,
				zoomScale: 1,
				showCategoryLabel: true,
				showValueLabel: false,
				showLegend: true,
				customTitle: '',
				chartHeight: 360,
				labelPosition: 'outside',
				color: '#4e79a7',
				colorScheme: 'Bold',
				customSliceColors: {},
				...overrides,
			},
		},
	};
}

function appendControls(controls) {
	controls.forEach(control => document.body.appendChild(control));
}

describe('pieControls UI structure', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	it('offers categorical columns plus an empty (none) option in the category select', () => {
		const dataset = createDataset();
		const controls = createPieChartControls(dataset, ['region', 'team'], ['sales'], ['region', 'team', 'sales']);
		appendControls(controls);

		const values = Array.from(document.getElementById('viz-select-pie-category').options).map(o => o.value);
		expect(values).toEqual(['', 'region', 'team']);
	});

	it('disables the value-column select when measureMode is count', () => {
		const countDataset = createDataset({ measureMode: 'count' });
		const countControls = createPieChartControls(countDataset, ['region'], ['sales'], ['region', 'sales']);
		appendControls(countControls);
		expect(document.getElementById('viz-select-pie-value-column').disabled).toBe(true);

		document.body.innerHTML = '';
		const sumDataset = createDataset({ measureMode: 'sum' });
		const sumControls = createPieChartControls(sumDataset, ['region'], ['sales'], ['region', 'sales']);
		appendControls(sumControls);
		expect(document.getElementById('viz-select-pie-value-column').disabled).toBe(false);
	});

	it('renders one per-slice color input per distinct sector value', () => {
		const dataset = createDataset();
		const controls = createPieChartControls(dataset, ['region'], ['sales'], ['region', 'sales']);
		appendControls(controls);

		const sliceInputs = document.querySelectorAll('input[data-color-grid-control="viz-pie-color-grid"]');
		expect(sliceInputs.length).toBe(3); // North, South, East
		const tokens = Array.from(sliceInputs).map(input => input.dataset.colorItem).sort();
		expect(tokens).toEqual(['East', 'North', 'South']);
	});
});

describe('pieControls listeners', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	it('commits a measureMode change through the facade and switches valueColumn defaults', () => {
		const dataset = createDataset({ measureMode: 'count', valueColumn: null });
		const controls = createPieChartControls(dataset, ['region'], ['sales'], ['region', 'sales']);
		appendControls(controls);

		const onConfigChanged = vi.fn();
		setupPieChartControlListeners(dataset, dataset.chartConfig.pie, ['sales'], ['region', 'sales'], onConfigChanged);

		const measureSelect = document.getElementById('viz-select-pie-measure');
		measureSelect.value = 'sum';
		measureSelect.dispatchEvent(new Event('change', { bubbles: true }));

		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledWith({
			pie: expect.objectContaining({ measureMode: 'sum', valueColumn: 'sales' }),
		});
		expect(onConfigChanged).toHaveBeenCalledTimes(1);
	});

	it('applies a color preset palette to the per-slice color map', () => {
		const dataset = createDataset();
		const controls = createPieChartControls(dataset, ['region'], ['sales'], ['region', 'sales']);
		appendControls(controls);

		setupPieChartControlListeners(dataset, dataset.chartConfig.pie, ['sales'], ['region', 'sales'], vi.fn());

		const boldButton = document.querySelector('button[data-color-preset-control="viz-pie-color-preset"][data-preset-name="Bold"]');
		expect(boldButton).not.toBeNull();
		boldButton.click();

		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledTimes(1);
		const call = mocks.updateActiveDatasetChartConfig.mock.calls[0][0];
		expect(call.pie.colorScheme).toBe('Bold');
		// One mapped color per distinct sector
		expect(Object.keys(call.pie.customSliceColors).sort()).toEqual(['East', 'North', 'South']);
	});

	// Regression guard for the P0 fix and the wider color-helper fix:
	// per-slice color writes must NEVER mutate dataset.chartConfig directly.
	// On `input`, the write goes through the non-emitting facade
	// (normalizeActiveDatasetConfig), no CONFIG_UPDATED emit, no sidebar
	// rebuild, but state stays consistent. On `change`, the emitting facade
	// commits the final value. If anyone re-introduces a bypass listener
	// (direct assignment to dataset.chartConfig.pie.customSliceColors), the
	// `normalizeActiveDatasetConfig` mock won't be called and this test fails.
	it('routes input writes through the non-emitting facade and commits via the emitting facade on change', () => {
		const dataset = createDataset();
		const controls = createPieChartControls(dataset, ['region'], ['sales'], ['region', 'sales']);
		appendControls(controls);

		setupPieChartControlListeners(dataset, dataset.chartConfig.pie, ['sales'], ['region', 'sales'], vi.fn());

		const sliceInput = document.querySelector('input[data-color-grid-control="viz-pie-color-grid"][data-color-item="North"]');
		expect(sliceInput).not.toBeNull();

		sliceInput.value = '#ff0000';
		sliceInput.dispatchEvent(new Event('input', { bubbles: true }));

		// No emitting facade call on input.
		expect(mocks.updateActiveDatasetChartConfig).not.toHaveBeenCalled();

		// Non-emitting facade write happened; the normalizer sets customSliceColors[North].
		expect(mocks.normalizeActiveDatasetConfig).toHaveBeenCalledTimes(1);
		const normalizer = mocks.normalizeActiveDatasetConfig.mock.calls[0][0];
		const result = normalizer({ pie: { customSliceColors: {} } });
		expect(result.pie.customSliceColors.North).toBe('#ff0000');

		sliceInput.dispatchEvent(new Event('change', { bubbles: true }));

		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledTimes(1);
		const call = mocks.updateActiveDatasetChartConfig.mock.calls[0][0];
		expect(call.pie.customSliceColors.North).toBe('#ff0000');
	});
});

describe('pieControls computeDefaults', () => {
	it('preserves the current category and valueColumn when they are still in scope', () => {
		const dataset = createDataset({ category: 'region', valueColumn: 'sales' });
		const ctx = { baseCategoricalOrAll: ['region', 'team'], numeric: ['sales', 'profit'] };
		expect(computeDefaults(dataset, ctx)).toEqual({ category: 'region', valueColumn: 'sales' });
	});

	it('falls back to the first option when the current value is out of scope', () => {
		const dataset = createDataset({ category: 'old', valueColumn: 'gone' });
		const ctx = { baseCategoricalOrAll: ['region', 'team'], numeric: ['sales'] };
		expect(computeDefaults(dataset, ctx)).toEqual({ category: 'region', valueColumn: 'sales' });
	});

	it('returns null when there are no candidate columns', () => {
		const dataset = createDataset();
		const ctx = { baseCategoricalOrAll: [], numeric: [] };
		expect(computeDefaults(dataset, ctx)).toEqual({ category: null, valueColumn: null });
	});
});
