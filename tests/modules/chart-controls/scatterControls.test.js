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

import { createScatterPlotControls, setupScatterPlotControlListeners } from '../../../src/modules/chart-controls/scatterControls.js';

function createDataset(scatterOverrides = {}) {
	return {
		configGraficos: {
			scatter: {
				enabled: true,
				expanded: true,
				x: 'value',
				y: 'value',
				xScale: 'log',
				yScale: 'linear',
				categoricalPairMode: 'jitter',
				radius: 3,
				opacity: 0.7,
				color: '#1a472a',
				colorMode: 'uniform',
				colorField: null,
				colorFieldType: null,
				gradientMinColor: '#1a472a',
				gradientMaxColor: '#ffffff',
				colorScheme: 'Bold',
				showXAxisLabel: true,
				showYAxisLabel: true,
				customTitle: '',
				chartHeight: 320,
				...scatterOverrides,
			},
		},
	};
}

function appendControls(controls) {
	controls.forEach(control => document.body.appendChild(control));
}

describe('scatterControls axis options', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	it('offers all visible columns for X and Y selectors', () => {
		const dataset = createDataset({ x: 'category', y: 'value' });
		const controls = createScatterPlotControls(dataset, ['value'], ['category', 'value']);
		appendControls(controls);

		const xValues = Array.from(document.getElementById('viz-select-x').options).map(option => option.value);
		const yValues = Array.from(document.getElementById('viz-select-y').options).map(option => option.value);

		expect(xValues).toContain('category');
		expect(yValues).toContain('category');
		expect(xValues).toContain('value');
		expect(yValues).toContain('value');
	});

	it('disables log scale selectors when selected axis is categorical', () => {
		const dataset = createDataset({ x: 'category', y: 'value' });
		const controls = createScatterPlotControls(dataset, ['value'], ['category', 'value']);
		appendControls(controls);

		expect(document.getElementById('viz-select-scatter-xscale').disabled).toBe(true);
		expect(document.getElementById('viz-select-scatter-yscale').disabled).toBe(false);
	});

	it('enables categorical mode selector only when both axes are categorical', () => {
		const mixedDataset = createDataset({ x: 'category', y: 'value' });
		const mixedControls = createScatterPlotControls(mixedDataset, ['value'], ['category', 'value']);
		appendControls(mixedControls);
		expect(document.getElementById('viz-select-scatter-categorical-mode').disabled).toBe(true);

		document.body.innerHTML = '';
		const categoricalDataset = createDataset({ x: 'category', y: 'group' });
		const categoricalControls = createScatterPlotControls(categoricalDataset, ['value'], ['category', 'group', 'value']);
		appendControls(categoricalControls);
		expect(document.getElementById('viz-select-scatter-categorical-mode').disabled).toBe(false);
	});
});

describe('scatterControls axis listeners', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	it('forces linear scale when switching an axis to categorical', () => {
		const dataset = createDataset({ x: 'value', xScale: 'log' });
		const controls = createScatterPlotControls(dataset, ['value'], ['category', 'value']);
		appendControls(controls);

		const onConfigChanged = vi.fn();
		setupScatterPlotControlListeners(dataset, ['value'], ['category', 'value'], onConfigChanged);

		const xSelect = document.getElementById('viz-select-x');
		xSelect.value = 'category';
		xSelect.dispatchEvent(new Event('change', { bubbles: true }));

		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledWith({
			scatter: expect.objectContaining({
				x: 'category',
				xScale: 'linear',
			}),
		});
		expect(onConfigChanged).toHaveBeenCalledTimes(1);
	});

	it('prevents selecting log scale for a categorical axis', () => {
		const dataset = createDataset({ x: 'category', xScale: 'linear' });
		const controls = createScatterPlotControls(dataset, ['value'], ['category', 'value']);
		appendControls(controls);

		const onConfigChanged = vi.fn();
		setupScatterPlotControlListeners(dataset, ['value'], ['category', 'value'], onConfigChanged);

		const xScale = document.getElementById('viz-select-scatter-xscale');
		xScale.value = 'log';
		xScale.dispatchEvent(new Event('change', { bubbles: true }));

		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledWith({
			scatter: expect.objectContaining({
				xScale: 'linear',
			}),
		});
		expect(onConfigChanged).toHaveBeenCalledTimes(1);
	});

	it('chooses categorical defaults when no numeric columns are available', () => {
		const dataset = createDataset({
			enabled: false,
			x: null,
			y: null,
			xScale: 'log',
			yScale: 'log',
		});

		const toggle = document.createElement('input');
		toggle.type = 'checkbox';
		toggle.id = 'viz-toggle-scatter';
		document.body.appendChild(toggle);

		const onConfigChanged = vi.fn();
		setupScatterPlotControlListeners(dataset, [], ['catA', 'catB'], onConfigChanged);

		toggle.checked = true;
		toggle.dispatchEvent(new Event('change', { bubbles: true }));

		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledWith({
			scatter: expect.objectContaining({
				enabled: true,
				x: 'catA',
				y: 'catB',
				xScale: 'linear',
				yScale: 'linear',
			}),
		});
		expect(onConfigChanged).toHaveBeenCalledTimes(1);
	});

	it('stores categorical pairing mode updates', () => {
		const dataset = createDataset({ x: 'category', y: 'group', categoricalPairMode: 'jitter' });
		const controls = createScatterPlotControls(dataset, ['value'], ['category', 'group', 'value']);
		appendControls(controls);

		const onConfigChanged = vi.fn();
		setupScatterPlotControlListeners(dataset, ['value'], ['category', 'group', 'value'], onConfigChanged);

		const pairMode = document.getElementById('viz-select-scatter-categorical-mode');
		pairMode.value = 'aggregate';
		pairMode.dispatchEvent(new Event('change', { bubbles: true }));

		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledWith({
			scatter: expect.objectContaining({
				categoricalPairMode: 'aggregate',
			}),
		});
		expect(onConfigChanged).toHaveBeenCalledTimes(1);
	});
});
