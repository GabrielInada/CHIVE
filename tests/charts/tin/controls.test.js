// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TIN_CONTROLS } from '../../../src/charts/tin/controls/descriptions.js';
import { computeDefaults } from '../../../src/charts/tin/controls/activationDefaults.js';
import { buildDescribedControls } from '../../../src/charts/shared/controls/describedControls.js';
import { COLOR_PRESETS } from '../../../src/charts/shared/controls/factories.js';
import { TIN_CHART, TIN_DEFINITION } from '../../../src/config/charts/definitions/tin.js';

/**
 * Writer test double. The controls' contract is that they hand the right
 * patch to the writer; merging it into state, firing onConfigChanged, and
 * live-rendering are the adapter's contract and are covered by
 * tests/features/datasetWorkspace/chartControls/chartConfigAdapter.test.js.
 */
function createWriter() {
	return { commit: vi.fn(), preview: vi.fn() };
}

describe('TIN controls module boundaries', () => {
	it('declares its controls as descriptions, with no builder or listener module', async () => {
		const [descriptions, defaults] = await Promise.all([
			import('../../../src/charts/tin/controls/descriptions.js'),
			import('../../../src/charts/tin/controls/activationDefaults.js'),
		]);
		expect(Object.keys(descriptions)).toEqual(['TIN_CONTROLS']);
		expect(Object.keys(defaults)).toEqual(['computeDefaults']);
		expect(TIN_CONTROLS.definition).toBe(TIN_DEFINITION);
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

function createContext({ numeric = ['lon', 'lat', 'elev'], categorical = ['name'] } = {}) {
	const allColumns = [...numeric, ...categorical];
	return {
		allColumns,
		numeric,
		categorical,
		baseCategoricalOrAll: categorical.length > 0 ? categorical : allColumns,
		dates: [],
		rows: [],
	};
}

function buildControls(dataset, writer = createWriter(), context = createContext(), translate = key => key) {
	return buildDescribedControls(TIN_CONTROLS, { dataset, context, writer, translate });
}

/** Build the controls into the document, as the sidebar does after each commit. */
function mountControls(dataset, writer = createWriter(), context = createContext(), translate = undefined) {
	document.body.replaceChildren(...buildControls(dataset, writer, context, translate));
	return writer;
}

function changeSelect(id, value) {
	const select = document.getElementById(id);
	if (!Array.from(select.options).some(option => option.value === value)) {
		select.appendChild(new Option(value, value));
	}
	select.value = value;
	select.dispatchEvent(new Event('change', { bubbles: true }));
}

function changeInput(id, value) {
	const input = document.getElementById(id);
	input.value = value;
	input.dispatchEvent(new Event('change', { bubbles: true }));
}

function lastConfig(writer) {
	return writer.commit.mock.calls.at(-1)[0];
}

function applyLastCommit(dataset, writer) {
	Object.assign(dataset.chartConfig.tin, lastConfig(writer));
}

function presetButton(name) {
	return document.querySelector(`button[data-color-preset-control="viz-tin-color-preset"][data-preset-name="${name}"]`);
}

function markedPresets() {
	return [...document.querySelectorAll('button[data-color-preset-control="viz-tin-color-preset"]')]
		.filter(button => button.style.border.startsWith('2px'))
		.map(button => button.dataset.presetName);
}

const byId = id => document.getElementById(id);
const optionValues = id => Array.from(byId(id).options, option => option.value);

describe('tinControls UI structure', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('matches the section and control-order structure snapshot', () => {
		const controls = buildControls(createDataset());

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
		mountControls(createDataset());

		for (const axis of ['x', 'y', 'z']) {
			expect(optionValues(`viz-select-tin-${axis}`)).toEqual(['', 'lon', 'lat', 'elev']);
		}
	});

	it('offers the fill modes, ramps, distributions and isoline modes the TIN definition lists', () => {
		mountControls(createDataset());

		expect(optionValues('viz-select-tin-fill-mode')).toEqual(TIN_DEFINITION.allowedValues.fillMode);
		expect(optionValues('viz-select-tin-color-ramp')).toEqual(TIN_DEFINITION.allowedValues.colorRamp);
		expect(optionValues('viz-select-tin-gradient-distribution')).toEqual(TIN_DEFINITION.allowedValues.gradientDistribution);
		expect(optionValues('viz-select-tin-isoline-mode')).toEqual(TIN_DEFINITION.allowedValues.isolineMode);
	});

	it('names each named ramp by itself and translates only the two-color ramp', () => {
		const translate = key => `[${key}]`;
		mountControls(createDataset(), createWriter(), createContext(), translate);

		expect(Array.from(byId('viz-select-tin-color-ramp').options, option => option.textContent)).toEqual([
			'[chive-chart-color-ramp-custom]',
			'Viridis',
			'Plasma',
			'Magma',
			'Inferno',
			'Turbo',
			'Terrain',
			'Grays',
		]);
	});

	it('shows "None" for any falsy axis, even beside columns named "0" and "false"', () => {
		mountControls(createDataset({ x: 0, y: false, z: 'elev' }), createWriter(), createContext({ numeric: ['0', 'false', 'elev'] }));

		expect(byId('viz-select-tin-x').selectedIndex).toBe(0);
		expect(byId('viz-select-tin-y').selectedIndex).toBe(0);
		expect(byId('viz-select-tin-z').value).toBe('elev');
	});

	it('disables the subdivision slider when fillMode is flat', () => {
		mountControls(createDataset({ fillMode: 'flat' }));
		expect(byId('viz-slider-tin-subdivision').disabled).toBe(true);

		mountControls(createDataset({ fillMode: 'smooth' }));
		expect(byId('viz-slider-tin-subdivision').disabled).toBe(false);
	});

	it('disables the custom-ramp gradient colors and palette while a named ramp draws the surface', () => {
		mountControls(createDataset({ colorRamp: 'viridis' }));
		expect(byId('viz-input-tin-gradient-min').disabled).toBe(true);
		expect(byId('viz-input-tin-gradient-max').disabled).toBe(true);
		expect(presetButton('Bold').disabled).toBe(true);

		mountControls(createDataset({ colorRamp: 'custom' }));
		expect(byId('viz-input-tin-gradient-min').disabled).toBe(false);
		expect(byId('viz-input-tin-gradient-max').disabled).toBe(false);
		expect(presetButton('Bold').disabled).toBe(false);
	});

	it('disables each overlay setting while its overlay is off', () => {
		mountControls(createDataset({ showEdges: false, showPoints: false, showHull: false, showIsolines: false, showThreshold: false }));

		for (const id of [
			'viz-input-tin-edge-color',
			'viz-slider-tin-point-radius',
			'viz-input-tin-hull-color',
			'viz-select-tin-isoline-mode',
			'viz-slider-tin-isoline-count',
			'viz-input-tin-isoline-step',
			'viz-input-tin-isoline-color',
			'viz-slider-tin-isoline-width',
			'viz-toggle-tin-color-isolines-by-z',
			'viz-input-tin-isoline-min-color',
			'viz-input-tin-isoline-max-color',
			'viz-toggle-tin-isoline-labels',
			'viz-slider-tin-isoline-label-size',
			'viz-input-tin-isoline-label-color',
			'viz-input-tin-threshold-value',
			'viz-input-tin-threshold-color',
			'viz-slider-tin-threshold-width',
		]) {
			expect(byId(id).disabled, id).toBe(true);
		}
	});

	it.each([
		[{ isolineMode: 'count', colorIsolinesByZ: false, showIsolineLabels: false }, { count: false, step: true, color: false, minMax: true, label: true }],
		[{ isolineMode: 'step', colorIsolinesByZ: true, showIsolineLabels: true }, { count: true, step: false, color: true, minMax: false, label: false }],
	])('with isolines on and %o, disables %o', (overrides, disabled) => {
		mountControls(createDataset({ showIsolines: true, ...overrides }));

		expect(byId('viz-slider-tin-isoline-count').disabled).toBe(disabled.count);
		expect(byId('viz-input-tin-isoline-step').disabled).toBe(disabled.step);
		expect(byId('viz-input-tin-isoline-color').disabled).toBe(disabled.color);
		expect(byId('viz-input-tin-isoline-min-color').disabled).toBe(disabled.minMax);
		expect(byId('viz-input-tin-isoline-max-color').disabled).toBe(disabled.minMax);
		expect(byId('viz-slider-tin-isoline-label-size').disabled).toBe(disabled.label);
		expect(byId('viz-input-tin-isoline-label-color').disabled).toBe(disabled.label);
	});

	it('shows the default isoline step for one that is not positive, and the default threshold for one that is not a number', () => {
		mountControls(createDataset({ isolineStep: 2.5, thresholdValue: '-3' }));
		expect(byId('viz-input-tin-isoline-step').value).toBe('2.5');
		expect(byId('viz-input-tin-threshold-value').value).toBe('-3');

		for (const isolineStep of [0, -2, 'bad', 'Infinity', null]) {
			mountControls(createDataset({ isolineStep }));
			expect(byId('viz-input-tin-isoline-step').value, String(isolineStep)).toBe(String(TIN_CHART.defaultIsolineStep));
		}
		for (const thresholdValue of ['bad', 'Infinity', undefined]) {
			mountControls(createDataset({ thresholdValue }));
			expect(byId('viz-input-tin-threshold-value').value, String(thresholdValue)).toBe(String(TIN_CHART.defaultThresholdValue));
		}
	});

	it.each([
		['viz-slider-tin-subdivision', TIN_CHART.minSubdivisionDepth, TIN_CHART.maxSubdivisionDepth, 1],
		['viz-slider-tin-point-radius', 1, 8, 1],
		['viz-slider-tin-isoline-count', TIN_CHART.minIsolineCount, TIN_CHART.maxIsolineCount, 1],
		['viz-slider-tin-isoline-width', TIN_CHART.minIsolineWidth, TIN_CHART.maxIsolineWidth, 0.1],
		['viz-slider-tin-isoline-label-size', TIN_CHART.minIsolineLabelSize, TIN_CHART.maxIsolineLabelSize, 1],
		['viz-slider-tin-threshold-width', TIN_CHART.minThresholdWidth, TIN_CHART.maxThresholdWidth, 0.1],
	])('gives %s the range min %s, max %s, step %s', (id, min, max, step) => {
		mountControls(createDataset());

		expect([byId(id).min, byId(id).max, byId(id).step]).toEqual([min, max, step].map(String));
	});

	it('shows the default point radius for a radius of 0', () => {
		mountControls(createDataset({ pointRadius: 0 }));

		expect(byId('viz-slider-tin-point-radius').value).toBe(String(TIN_CHART.defaultPointRadius));
	});

	it('lets the isoline step take any positive decimal and the threshold any decimal', () => {
		mountControls(createDataset());

		expect(byId('viz-input-tin-isoline-step').min).toBe('0');
		expect(byId('viz-input-tin-isoline-step').step).toBe('any');
		expect(byId('viz-input-tin-threshold-value').hasAttribute('min')).toBe(false);
		expect(byId('viz-input-tin-threshold-value').step).toBe('any');
	});

	it('falls back invalid options and disables all controls when chart is off', () => {
		mountControls(createDataset({
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
		}));

		expect(byId('viz-select-tin-x').value).toBe('');
		expect(byId('viz-select-tin-fill-mode').value).toBe('smooth');
		expect(byId('viz-select-tin-color-ramp').value).toBe('custom');
		// An empty colorScheme falls back to no palette: the gradient colors are not a palette's.
		expect(markedPresets()).toEqual([]);
		expect(byId('viz-select-tin-gradient-distribution').value).toBe('value');
		expect(byId('viz-slider-tin-subdivision').value).toBe(String(TIN_CHART.defaultSubdivisionDepth));
		const states = [...document.querySelectorAll('.chart-section-content :is(select, input, button)')].map(element => element.disabled);
		// 35 selects and inputs, and the palette buttons.
		expect(states).toHaveLength(35 + Object.keys(COLOR_PRESETS).length);
		expect(states.every(Boolean)).toBe(true);
	});
});

describe('tinControls writes', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('writes the fill mode, color ramp and isoline mode', () => {
		const writer = mountControls(createDataset({ showIsolines: true }));

		changeSelect('viz-select-tin-fill-mode', 'flat');
		expect(lastConfig(writer)).toEqual({ fillMode: 'flat' });
		changeSelect('viz-select-tin-color-ramp', 'viridis');
		expect(lastConfig(writer)).toEqual({ colorRamp: 'viridis' });
		changeSelect('viz-select-tin-isoline-mode', 'step');
		expect(lastConfig(writer)).toEqual({ isolineMode: 'step' });
		expect(writer.commit).toHaveBeenCalledTimes(3);
	});

	it('writes axis picks clamped to the numeric columns, null for none or a forged option', () => {
		const writer = mountControls(createDataset());

		changeSelect('viz-select-tin-x', '');
		expect(lastConfig(writer)).toEqual({ x: null });
		changeSelect('viz-select-tin-y', 'not-numeric');
		expect(lastConfig(writer)).toEqual({ y: null });
		changeSelect('viz-select-tin-z', 'elev');
		expect(lastConfig(writer)).toEqual({ z: 'elev' });
	});

	// The commit canonicalizes forged enumerated values.
	it('commits forged enumerated selections as chosen', () => {
		const writer = mountControls(createDataset());

		changeSelect('viz-select-tin-gradient-distribution', 'bogus');
		expect(lastConfig(writer)).toEqual({ gradientDistribution: 'bogus' });
		changeSelect('viz-select-tin-fill-mode', 'bogus');
		expect(lastConfig(writer)).toEqual({ fillMode: 'bogus' });
		changeSelect('viz-select-tin-isoline-mode', 'bogus');
		expect(lastConfig(writer)).toEqual({ isolineMode: 'bogus' });
		changeSelect('viz-select-tin-color-ramp', 'bogus');
		expect(lastConfig(writer)).toEqual({ colorRamp: 'bogus' });
	});

	it('copies a palette\'s extremes into the gradient colors', () => {
		const writer = mountControls(createDataset());

		presetButton('Bold').click();

		expect(writer.commit).toHaveBeenCalledTimes(1);
		expect(lastConfig(writer)).toEqual({
			colorScheme: 'Bold',
			gradientMinColor: COLOR_PRESETS.Bold[0],
			gradientMaxColor: COLOR_PRESETS.Bold.at(-1),
		});
	});

	it.each([
		['viz-toggle-tin-x-label', 'showXAxisLabel', false],
		['viz-toggle-tin-edges', 'showEdges', false],
		['viz-toggle-tin-hull', 'showHull', true],
		['viz-toggle-tin-isolines', 'showIsolines', true],
		['viz-toggle-tin-threshold', 'showThreshold', true],
	])('commits %s as %s', (id, key, checked) => {
		const writer = mountControls(createDataset({ showIsolines: false }));

		byId(id).click();

		expect(writer.commit).toHaveBeenCalledWith({ [key]: checked });
	});

	it('commits a typed isoline step or threshold as a number, and the default for one that is not a number', () => {
		const writer = mountControls(createDataset({ showIsolines: true, isolineMode: 'step', showThreshold: true }));

		changeInput('viz-input-tin-isoline-step', '2.5');
		expect(lastConfig(writer)).toEqual({ isolineStep: 2.5 });
		changeInput('viz-input-tin-isoline-step', '');
		expect(lastConfig(writer)).toEqual({ isolineStep: TIN_CHART.defaultIsolineStep });
		changeInput('viz-input-tin-threshold-value', '-7.25');
		expect(lastConfig(writer)).toEqual({ thresholdValue: -7.25 });
		changeInput('viz-input-tin-threshold-value', 'abc');
		expect(lastConfig(writer)).toEqual({ thresholdValue: TIN_CHART.defaultThresholdValue });
	});

	it('writes no isoline step while it is typed', () => {
		const writer = mountControls(createDataset({ showIsolines: true, isolineMode: 'step' }));
		const input = byId('viz-input-tin-isoline-step');

		input.value = '3';
		input.dispatchEvent(new Event('input', { bubbles: true }));

		expect(writer.commit).not.toHaveBeenCalled();
		expect(writer.preview).not.toHaveBeenCalled();
	});

	it.each([
		['viz-slider-tin-subdivision', 'subdivisionDepth', '2', 2],
		['viz-slider-tin-point-radius', 'pointRadius', '6', 6],
		['viz-slider-tin-isoline-count', 'isolineCount', '12', 12],
		['viz-slider-tin-isoline-width', 'isolineWidth', '1.7', 1.7],
		['viz-slider-tin-isoline-label-size', 'isolineLabelSize', '13', 13],
		['viz-slider-tin-threshold-width', 'thresholdWidth', '3.3', 3.3],
	])('commits the %s slider as a number', (id, key, value, stored) => {
		const writer = mountControls(createDataset());

		changeInput(id, value);

		expect(writer.commit).toHaveBeenCalledWith({ [key]: stored });
	});

	it('previews an overlay color while the picker is open and commits its fallback for an invalid one', () => {
		const writer = mountControls(createDataset({ showThreshold: true }));
		const input = byId('viz-input-tin-threshold-color');

		input.value = '#123456';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		expect(writer.preview).toHaveBeenCalledWith({ thresholdColor: '#123456' });

		input.type = 'text';
		input.value = 'not-a-color';
		input.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer)).toEqual({ thresholdColor: TIN_CHART.defaultThresholdColor });
	});
});

describe('tinControls color palette mark', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('marks no palette on a new chart', () => {
		const { colorRamp, colorScheme, gradientMinColor, gradientMaxColor } = TIN_DEFINITION.createDefaultConfig();
		mountControls(createDataset({ colorRamp, colorScheme, gradientMinColor, gradientMaxColor }));

		expect(markedPresets()).toEqual([]);
	});

	it('marks a palette once its button applies it, until a gradient color is edited', () => {
		const dataset = createDataset();
		const writer = createWriter();
		mountControls(dataset, writer);

		presetButton('Bold').click();
		applyLastCommit(dataset, writer);
		mountControls(dataset, writer);
		expect(markedPresets()).toEqual(['Bold']);

		const maxInput = byId('viz-input-tin-gradient-max');
		maxInput.value = '#ffffff';
		maxInput.dispatchEvent(new Event('change'));
		applyLastCommit(dataset, writer);
		mountControls(dataset, writer);
		expect(markedPresets()).toEqual([]);
	});

	it('marks no palette while a named ramp draws the surface', () => {
		mountControls(createDataset({
			colorRamp: 'viridis',
			gradientMinColor: COLOR_PRESETS.Bold[0],
			gradientMaxColor: COLOR_PRESETS.Bold.at(-1),
		}));

		expect(markedPresets()).toEqual([]);
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
