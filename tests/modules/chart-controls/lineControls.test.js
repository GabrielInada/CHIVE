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

vi.mock('../../../src/modules/chart-controls/livePreview.js', () => ({
	triggerLiveRender: vi.fn(),
}));

import { createLineChartControls, setupLineChartControlListeners } from '../../../src/modules/chart-controls/lineControls.js';

function createDataset(overrides = {}) {
	return {
		configGraficos: {
			line: {
				enabled: true,
				expanded: true,
				x: 'month',
				y: 'visits',
				customTitle: '',
				chartHeight: 320,
				curve: 'linear',
				missingMode: 'connect',
				strokeWidth: 1.5,
				color: '#4e79a7',
				ghostStrokeColor: '#cccccc',
				showPoints: false,
				sortX: true,
				aggregateMode: 'none',
				showXAxisLabel: true,
				showYAxisLabel: true,
				...overrides,
			},
		},
	};
}

function appendControls(controls) {
	controls.forEach(control => document.body.appendChild(control));
}

describe('lineControls UI structure', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	it('offers every visible column as X and only numeric columns as Y', () => {
		const dataset = createDataset();
		const controls = createLineChartControls(dataset, ['visits', 'signups'], ['month'], ['month', 'visits', 'signups']);
		appendControls(controls);

		const xValues = Array.from(document.getElementById('viz-select-line-x').options).map(o => o.value);
		const yValues = Array.from(document.getElementById('viz-select-line-y').options).map(o => o.value);

		expect(xValues).toContain('month');
		expect(xValues).toContain('visits');
		expect(yValues).toContain('visits');
		expect(yValues).not.toContain('month');
	});

	it('disables the ghost color picker when missing mode is not interpolate', () => {
		const connectDataset = createDataset({ missingMode: 'connect' });
		const connectControls = createLineChartControls(connectDataset, ['visits'], ['month'], ['month', 'visits']);
		appendControls(connectControls);
		expect(document.getElementById('viz-input-line-ghost-color').disabled).toBe(true);

		document.body.innerHTML = '';
		const interpDataset = createDataset({ missingMode: 'interpolate' });
		const interpControls = createLineChartControls(interpDataset, ['visits'], ['month'], ['month', 'visits']);
		appendControls(interpControls);
		expect(document.getElementById('viz-input-line-ghost-color').disabled).toBe(false);
	});
});

describe('lineControls listeners', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	it('updates curve when the user changes the curve select', () => {
		const dataset = createDataset();
		const controls = createLineChartControls(dataset, ['visits'], ['month'], ['month', 'visits']);
		appendControls(controls);

		const onConfigChanged = vi.fn();
		setupLineChartControlListeners(dataset, ['visits'], ['month'], ['month', 'visits'], onConfigChanged);

		const select = document.getElementById('viz-select-line-curve');
		select.value = 'monotone';
		select.dispatchEvent(new Event('change', { bubbles: true }));

		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledWith({
			line: expect.objectContaining({ curve: 'monotone' }),
		});
		expect(onConfigChanged).toHaveBeenCalledTimes(1);
	});

	it('coerces an unknown missingMode to the default value', () => {
		const dataset = createDataset();
		const controls = createLineChartControls(dataset, ['visits'], ['month'], ['month', 'visits']);
		appendControls(controls);

		setupLineChartControlListeners(dataset, ['visits'], ['month'], ['month', 'visits'], vi.fn());

		const select = document.getElementById('viz-select-line-missing');
		select.value = 'gap';
		select.dispatchEvent(new Event('change', { bubbles: true }));

		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledWith({
			line: expect.objectContaining({ missingMode: 'gap' }),
		});
	});

	it('rejects Y values that are not numeric columns', () => {
		const dataset = createDataset();
		const controls = createLineChartControls(dataset, ['visits'], ['month'], ['month', 'visits']);
		appendControls(controls);

		setupLineChartControlListeners(dataset, ['visits'], ['month'], ['month', 'visits'], vi.fn());

		const ySelect = document.getElementById('viz-select-line-y');
		ySelect.value = '';
		ySelect.dispatchEvent(new Event('change', { bubbles: true }));

		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledWith({
			line: expect.objectContaining({ y: null }),
		});
	});

	it('toggles sortX through the checkbox', () => {
		const dataset = createDataset();
		const controls = createLineChartControls(dataset, ['visits'], ['month'], ['month', 'visits']);
		appendControls(controls);

		setupLineChartControlListeners(dataset, ['visits'], ['month'], ['month', 'visits'], vi.fn());

		const checkbox = document.getElementById('viz-toggle-line-sort-x');
		checkbox.checked = false;
		checkbox.dispatchEvent(new Event('change', { bubbles: true }));

		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledWith({
			line: expect.objectContaining({ sortX: false }),
		});
	});
});
