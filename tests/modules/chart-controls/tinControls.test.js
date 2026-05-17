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

import {
	createTinControls,
	setupTinControlListeners,
	computeDefaults,
} from '../../../src/modules/chart-controls/tinControls.js';

function createDataset(overrides = {}) {
	return {
		configGraficos: {
			tin: {
				enabled: true,
				expanded: true,
				x: 'lon',
				y: 'lat',
				z: 'elev',
				customTitle: '',
				chartHeight: 460,
				showXAxisLabel: true,
				showYAxisLabel: true,
				fillMode: 'smooth',
				subdivisionDepth: 3,
				colorRamp: 'custom',
				colorScheme: 'Colorblind-Safe',
				gradientMinColor: '#0a3d62',
				gradientMaxColor: '#ffffff',
				gradientDistribution: 'value',
				showEdges: true,
				edgeColor: '#5f5a53',
				showPoints: true,
				pointRadius: 3,
				showZLabels: false,
				showHull: false,
				hullColor: '#3f3a33',
				showIsolines: false,
				isolineMode: 'count',
				isolineCount: 5,
				isolineStep: 1,
				isolineColor: '#1f2937',
				isolineWidth: 0.8,
				colorIsolinesByZ: false,
				isolineMinColor: '#1e40af',
				isolineMaxColor: '#dc2626',
				showIsolineLabels: false,
				isolineLabelSize: 10,
				isolineLabelColor: '#1f2937',
				showThreshold: false,
				thresholdValue: 0,
				thresholdColor: '#dc2626',
				thresholdWidth: 2,
				...overrides,
			},
		},
	};
}

function appendControls(controls) {
	controls.forEach(control => document.body.appendChild(control));
}

describe('tinControls UI structure', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	it('offers only numeric columns plus the none option for x/y/z', () => {
		const dataset = createDataset();
		const controls = createTinControls(dataset, ['lon', 'lat', 'elev'], ['lon', 'lat', 'elev', 'name']);
		appendControls(controls);

		const xValues = Array.from(document.getElementById('viz-select-tin-x').options).map(o => o.value);
		expect(xValues).toEqual(['', 'lon', 'lat', 'elev']);
	});

	it('disables the subdivision slider when fillMode is flat', () => {
		const flatDataset = createDataset({ fillMode: 'flat' });
		const flatControls = createTinControls(flatDataset, ['lon', 'lat', 'elev'], []);
		appendControls(flatControls);
		expect(document.getElementById('viz-slider-tin-subdivision').disabled).toBe(true);

		document.body.innerHTML = '';
		const smoothDataset = createDataset({ fillMode: 'smooth' });
		const smoothControls = createTinControls(smoothDataset, ['lon', 'lat', 'elev'], []);
		appendControls(smoothControls);
		expect(document.getElementById('viz-slider-tin-subdivision').disabled).toBe(false);
	});

	it('disables the custom-gradient color inputs when colorRamp is a named preset', () => {
		const namedDataset = createDataset({ colorRamp: 'viridis' });
		const namedControls = createTinControls(namedDataset, ['lon', 'lat', 'elev'], []);
		appendControls(namedControls);
		expect(document.getElementById('viz-input-tin-gradient-min').disabled).toBe(true);
		expect(document.getElementById('viz-input-tin-gradient-max').disabled).toBe(true);

		document.body.innerHTML = '';
		const customDataset = createDataset({ colorRamp: 'custom' });
		const customControls = createTinControls(customDataset, ['lon', 'lat', 'elev'], []);
		appendControls(customControls);
		expect(document.getElementById('viz-input-tin-gradient-min').disabled).toBe(false);
		expect(document.getElementById('viz-input-tin-gradient-max').disabled).toBe(false);
	});

	it('disables isoline subordinate controls when isolines are off', () => {
		const offDataset = createDataset({ showIsolines: false });
		const offControls = createTinControls(offDataset, ['lon', 'lat', 'elev'], []);
		appendControls(offControls);
		expect(document.getElementById('viz-select-tin-isoline-mode').disabled).toBe(true);
		expect(document.getElementById('viz-slider-tin-isoline-count').disabled).toBe(true);
		expect(document.getElementById('viz-slider-tin-isoline-width').disabled).toBe(true);
	});
});

describe('tinControls listeners', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	it('coerces the fillMode select to smooth or flat through the transform', () => {
		const dataset = createDataset();
		const controls = createTinControls(dataset, ['lon', 'lat', 'elev'], []);
		appendControls(controls);

		const onConfigChanged = vi.fn();
		setupTinControlListeners(dataset, ['lon', 'lat', 'elev'], [], onConfigChanged);

		const select = document.getElementById('viz-select-tin-fill-mode');
		select.value = 'flat';
		select.dispatchEvent(new Event('change', { bubbles: true }));

		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledWith({
			tin: expect.objectContaining({ fillMode: 'flat' }),
		});
		expect(onConfigChanged).toHaveBeenCalledTimes(1);
	});

	it('rejects a non-numeric x column by transforming the value to null', () => {
		const dataset = createDataset();
		const controls = createTinControls(dataset, ['lon', 'lat', 'elev'], []);
		appendControls(controls);

		setupTinControlListeners(dataset, ['lon', 'lat', 'elev'], [], vi.fn());

		const select = document.getElementById('viz-select-tin-x');
		select.value = '';
		select.dispatchEvent(new Event('change', { bubbles: true }));

		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledWith({
			tin: expect.objectContaining({ x: null }),
		});
	});

	it('commits a recognized colorRamp preset through the facade', () => {
		const dataset = createDataset({ colorRamp: 'custom' });
		const controls = createTinControls(dataset, ['lon', 'lat', 'elev'], []);
		appendControls(controls);

		setupTinControlListeners(dataset, ['lon', 'lat', 'elev'], [], vi.fn());

		const select = document.getElementById('viz-select-tin-color-ramp');
		select.value = 'viridis';
		select.dispatchEvent(new Event('change', { bubbles: true }));

		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledWith({
			tin: expect.objectContaining({ colorRamp: 'viridis' }),
		});
	});

	it('color preset button maps the palette extremes to gradient min and max', () => {
		const dataset = createDataset();
		const controls = createTinControls(dataset, ['lon', 'lat', 'elev'], []);
		appendControls(controls);

		setupTinControlListeners(dataset, ['lon', 'lat', 'elev'], [], vi.fn());

		const bold = document.querySelector('button[data-color-preset-control="viz-tin-color-preset"][data-preset-name="Bold"]');
		expect(bold).not.toBeNull();
		bold.click();

		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledTimes(1);
		const call = mocks.updateActiveDatasetChartConfig.mock.calls[0][0];
		expect(call.tin.colorScheme).toBe('Bold');
		expect(call.tin.gradientMinColor).toMatch(/^#[0-9a-fA-F]{6}$/);
		expect(call.tin.gradientMaxColor).toMatch(/^#[0-9a-fA-F]{6}$/);
		expect(call.tin.gradientMinColor).not.toBe(call.tin.gradientMaxColor);
	});

	it('toggling showIsolines commits the boolean through the facade', () => {
		const dataset = createDataset({ showIsolines: false });
		const controls = createTinControls(dataset, ['lon', 'lat', 'elev'], []);
		appendControls(controls);

		setupTinControlListeners(dataset, ['lon', 'lat', 'elev'], [], vi.fn());

		const toggle = document.getElementById('viz-toggle-tin-isolines');
		toggle.checked = true;
		toggle.dispatchEvent(new Event('change', { bubbles: true }));

		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledWith({
			tin: expect.objectContaining({ showIsolines: true }),
		});
	});
});

describe('tinControls computeDefaults', () => {
	it('returns three distinct numeric columns when available', () => {
		const dataset = createDataset({ x: null, y: null, z: null });
		const result = computeDefaults(dataset, { numericas: ['a', 'b', 'c', 'd'] });
		// Picks must be distinct (the helper avoids already-picked values).
		expect(new Set([result.x, result.y, result.z]).size).toBe(3);
		// x is always the first element; y/z are picked via pickPreferred so
		// the exact pair depends on the filter+index logic, not just order.
		expect(result.x).toBe('a');
	});

	it('preserves an existing valid triple without rotating it', () => {
		const dataset = createDataset({ x: 'lon', y: 'lat', z: 'elev' });
		const result = computeDefaults(dataset, { numericas: ['lon', 'lat', 'elev', 'extra'] });
		expect(result).toEqual({ x: 'lon', y: 'lat', z: 'elev' });
	});

	it('returns nulls for y and z when only one numeric column is available', () => {
		const dataset = createDataset({ x: null, y: null, z: null });
		const result = computeDefaults(dataset, { numericas: ['only'] });
		expect(result.x).toBe('only');
		// pickPreferred filters out already-picked values; with only one column,
		// the avoid list empties the candidate pool and y/z fall back to null.
		expect(result.y).toBeNull();
		expect(result.z).toBeNull();
	});
});
