// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn(key => key),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
}));

import {
	createTinControls,
} from '../../../src/charts/tin/controls/builder.js';
import { setupTinControlListeners } from '../../../src/charts/tin/controls/listeners.js';
import { computeDefaults } from '../../../src/charts/tin/controls/activationDefaults.js';

/**
 * Writer test double. The listeners' contract is that they hand the right
 * patch to the writer; merging it into state, firing onConfigChanged, and
 * live-rendering are the adapter's contract and are covered by
 * tests/features/datasetWorkspace/chartControls/chartConfigAdapter.test.js.
 */
function createWriter() {
	return { commit: vi.fn(), preview: vi.fn() };
}

describe('TIN controls module boundaries', () => {
	it('keeps builder, listener, and defaults exports in dedicated modules', async () => {
		const [builder, listeners, defaults] = await Promise.all([
			import('../../../src/charts/tin/controls/builder.js'),
			import('../../../src/charts/tin/controls/listeners.js'),
			import('../../../src/charts/tin/controls/activationDefaults.js'),
		]);
		expect(Object.keys(builder)).toEqual(['createTinControls']);
		expect(Object.keys(listeners)).toEqual(['setupTinControlListeners']);
		expect(Object.keys(defaults)).toEqual(['computeDefaults']);
	});
});

function createDataset(overrides = {}) {
	return {
		chartConfig: {
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

function changeSelect(id, value) {
	const select = document.getElementById(id);
	if (!Array.from(select.options).some(option => option.value === value)) {
		select.appendChild(new Option(value, value));
	}
	select.value = value;
	select.dispatchEvent(new Event('change', { bubbles: true }));
}

function lastTinConfig(writer) {
	return writer.commit.mock.calls.at(-1)[0];
}

describe('tinControls UI structure', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	it('matches the section and control-order structure snapshot', () => {
		const dataset = createDataset();
		const controls = createTinControls(dataset, ['lon', 'lat', 'elev'], ['lon', 'lat', 'elev', 'name']);

		const structure = controls.map(section => {
			const content = section.querySelector('.chart-section-content');
			const controlKeys = Array.from(content.children).map(control => {
				const idElement = control.matches('[id]') ? control : control.querySelector('[id]');
				if (idElement?.id) return idElement.id;
				return control.querySelector('[data-color-preset-control]')?.dataset.colorPresetControl;
			});
			expect(controlKeys).not.toContain(undefined);

			return {
				section: section.dataset.section,
				expanded: section.querySelector('.chart-section-header').getAttribute('aria-expanded'),
				controlKeys,
			};
		});

		expect(structure).toMatchSnapshot();
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

	it('falls back invalid options and disables all controls when chart is off', () => {
		const dataset = createDataset({
			enabled: false,
			x: null,
			y: null,
			z: null,
			customTitle: 'Surface',
			fillMode: 'unsupported',
			subdivisionDepth: undefined,
			colorRamp: 'not-a-ramp',
			colorScheme: '',
			gradientDistribution: '',
			showEdges: false,
			showPoints: false,
			showHull: false,
			showIsolines: true,
			isolineMode: 'step',
			isolineStep: 'bad',
			colorIsolinesByZ: true,
			showIsolineLabels: true,
			showThreshold: true,
			thresholdValue: 'bad',
		});

		appendControls(createTinControls(dataset, ['lon', 'lat', 'elev'], []));

		expect(document.getElementById('viz-select-tin-x').value).toBe('');
		expect(document.getElementById('viz-select-tin-fill-mode').value).toBe('smooth');
		expect(document.getElementById('viz-select-tin-color-ramp').value).toBe('custom');
		const selectedPreset = document.querySelector('button[data-color-preset-control="viz-tin-color-preset"][data-preset-name="Colorblind-Safe"]');
		expect(selectedPreset?.style.border).toContain('2px');
		expect(document.getElementById('viz-select-tin-gradient-distribution').value).toBe('value');
		expect(document.getElementById('viz-slider-tin-subdivision').disabled).toBe(true);
		expect(document.getElementById('viz-input-tin-edge-color').disabled).toBe(true);
		expect(document.getElementById('viz-slider-tin-point-radius').disabled).toBe(true);
		expect(document.getElementById('viz-input-tin-hull-color').disabled).toBe(true);
		expect(document.getElementById('viz-input-tin-isoline-color').disabled).toBe(true);
		expect(document.getElementById('viz-input-tin-isoline-min-color').disabled).toBe(true);
		expect(document.getElementById('viz-slider-tin-isoline-label-size').disabled).toBe(true);
		expect(document.getElementById('viz-input-tin-threshold-value').disabled).toBe(true);
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

		const writer = createWriter();
		setupTinControlListeners(dataset, ['lon', 'lat', 'elev'], [], writer);

		const select = document.getElementById('viz-select-tin-fill-mode');
		select.value = 'flat';
		select.dispatchEvent(new Event('change', { bubbles: true }));

		expect(writer.commit).toHaveBeenCalledWith(expect.objectContaining({ fillMode: 'flat' }));
		expect(writer.commit).toHaveBeenCalledTimes(1);
	});

	it('rejects a non-numeric x column by transforming the value to null', () => {
		const dataset = createDataset();
		const controls = createTinControls(dataset, ['lon', 'lat', 'elev'], []);
		appendControls(controls);

		const writer = createWriter();
		setupTinControlListeners(dataset, ['lon', 'lat', 'elev'], [], writer);

		const select = document.getElementById('viz-select-tin-x');
		select.value = '';
		select.dispatchEvent(new Event('change', { bubbles: true }));

		expect(writer.commit).toHaveBeenCalledWith(expect.objectContaining({ x: null }));
	});

	it('commits a recognized colorRamp preset through the facade', () => {
		const dataset = createDataset({ colorRamp: 'custom' });
		const controls = createTinControls(dataset, ['lon', 'lat', 'elev'], []);
		appendControls(controls);

		const writer = createWriter();
		setupTinControlListeners(dataset, ['lon', 'lat', 'elev'], [], writer);

		const select = document.getElementById('viz-select-tin-color-ramp');
		select.value = 'viridis';
		select.dispatchEvent(new Event('change', { bubbles: true }));

		expect(writer.commit).toHaveBeenCalledWith(expect.objectContaining({ colorRamp: 'viridis' }));
	});

	it('color preset button maps the palette extremes to gradient min and max', () => {
		const dataset = createDataset();
		const controls = createTinControls(dataset, ['lon', 'lat', 'elev'], []);
		appendControls(controls);

		const writer = createWriter();
		setupTinControlListeners(dataset, ['lon', 'lat', 'elev'], [], writer);

		const bold = document.querySelector('button[data-color-preset-control="viz-tin-color-preset"][data-preset-name="Bold"]');
		expect(bold).not.toBeNull();
		bold.click();

		expect(writer.commit).toHaveBeenCalledTimes(1);
		const call = writer.commit.mock.calls[0][0];
		expect(call.colorScheme).toBe('Bold');
		expect(call.gradientMinColor).toMatch(/^#[0-9a-fA-F]{6}$/);
		expect(call.gradientMaxColor).toMatch(/^#[0-9a-fA-F]{6}$/);
		expect(call.gradientMinColor).not.toBe(call.gradientMaxColor);
	});

	it('toggling showIsolines commits the boolean through the facade', () => {
		const dataset = createDataset({ showIsolines: false });
		const controls = createTinControls(dataset, ['lon', 'lat', 'elev'], []);
		appendControls(controls);

		const writer = createWriter();
		setupTinControlListeners(dataset, ['lon', 'lat', 'elev'], [], writer);

		const toggle = document.getElementById('viz-toggle-tin-isolines');
		toggle.checked = true;
		toggle.dispatchEvent(new Event('change', { bubbles: true }));

		expect(writer.commit).toHaveBeenCalledWith(expect.objectContaining({ showIsolines: true }));
	});

	it('coerces invalid select listener values to safe defaults', () => {
		const dataset = createDataset();
		appendControls(createTinControls(dataset, ['lon', 'lat', 'elev'], []));
		const writer = createWriter();
		setupTinControlListeners(dataset, ['lon', 'lat', 'elev'], [], writer);

		changeSelect('viz-select-tin-y', 'not-numeric');
		expect(lastTinConfig(writer).y).toBeNull();

		changeSelect('viz-select-tin-z', 'elev');
		expect(lastTinConfig(writer).z).toBe('elev');

		changeSelect('viz-select-tin-gradient-distribution', 'bogus');
		expect(lastTinConfig(writer).gradientDistribution).toBe('value');

		changeSelect('viz-select-tin-fill-mode', 'bogus');
		expect(lastTinConfig(writer).fillMode).toBe('smooth');

		changeSelect('viz-select-tin-isoline-mode', 'bogus');
		expect(lastTinConfig(writer).isolineMode).toBe('count');

		changeSelect('viz-select-tin-color-ramp', 'bogus');
		expect(lastTinConfig(writer).colorRamp).toBe('custom');
	});

	it('still wires listeners when controls are absent', () => {
		const dataset = createDataset();
		const writer = createWriter();
		expect(() => setupTinControlListeners(dataset, ['lon'], [], writer)).not.toThrow();
		expect(writer.commit).not.toHaveBeenCalled();
	});
});

describe('tinControls computeDefaults', () => {
	it('returns three distinct numeric columns when available', () => {
		const dataset = createDataset({ x: null, y: null, z: null });
		const result = computeDefaults(dataset, { numeric: ['a', 'b', 'c', 'd'] });
		// Picks must be distinct (the helper avoids already-picked values).
		expect(new Set([result.x, result.y, result.z]).size).toBe(3);
		// x is always the first element; y/z are picked via pickPreferred so
		// the exact pair depends on the filter+index logic, not just order.
		expect(result.x).toBe('a');
	});

	it('preserves an existing valid triple without rotating it', () => {
		const dataset = createDataset({ x: 'lon', y: 'lat', z: 'elev' });
		const result = computeDefaults(dataset, { numeric: ['lon', 'lat', 'elev', 'extra'] });
		expect(result).toEqual({ x: 'lon', y: 'lat', z: 'elev' });
	});

	it('returns nulls for y and z when only one numeric column is available', () => {
		const dataset = createDataset({ x: null, y: null, z: null });
		const result = computeDefaults(dataset, { numeric: ['only'] });
		expect(result.x).toBe('only');
		// pickPreferred filters out already-picked values; with only one column,
		// the avoid list empties the candidate pool and y/z fall back to null.
		expect(result.y).toBeNull();
		expect(result.z).toBeNull();
	});

	it('replaces duplicate existing picks with distinct available numerics', () => {
		const dataset = createDataset({ x: 'lon', y: 'lon', z: 'lat' });
		const result = computeDefaults(dataset, { numeric: ['lon', 'lat', 'elev'] });
		expect(result).toEqual({ x: 'lon', y: 'elev', z: 'lat' });
	});

	it('falls back to nulls when chartConfig is absent', () => {
		const result = computeDefaults({}, {});
		expect(result).toEqual({ x: null, y: null, z: null });
	});
});
