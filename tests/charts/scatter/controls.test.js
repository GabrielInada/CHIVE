// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn(key => key),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
}));

import { createScatterPlotControls } from '../../../src/charts/scatter/controls/builder.js';
import { setupScatterPlotControlListeners } from '../../../src/charts/scatter/controls/listeners.js';
import { computeDefaults } from '../../../src/charts/scatter/controls/defaults.js';

/**
 * Writer test double. The listeners' contract is that they hand the right
 * patch to the writer; merging it into state, firing onConfigChanged, and
 * live-rendering are the adapter's contract and are covered by
 * tests/features/datasetWorkspace/chartControls/chartConfigAdapter.test.js.
 */
function createWriter() {
	return { commit: vi.fn(), preview: vi.fn() };
}

function createDataset(scatterOverrides = {}) {
	return {
		chartConfig: {
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

function selectValue(id, value) {
	const select = document.getElementById(id);
	if (![...select.options].some(option => option.value === value)) {
		const option = document.createElement('option');
		option.value = value;
		select.appendChild(option);
	}
	select.value = value;
	select.dispatchEvent(new Event('change', { bubbles: true }));
}

function lastConfig(writer) {
	return writer.commit.mock.calls.at(-1)[0];
}

describe('scatter controls module boundaries', () => {
	it('keeps builder, listener, and defaults exports in dedicated modules', async () => {
		const [builder, listeners, defaults] = await Promise.all([
			import('../../../src/charts/scatter/controls/builder.js'),
			import('../../../src/charts/scatter/controls/listeners.js'),
			import('../../../src/charts/scatter/controls/defaults.js'),
		]);
		expect(Object.keys(builder)).toEqual(['createScatterPlotControls']);
		expect(Object.keys(listeners)).toEqual(['setupScatterPlotControlListeners']);
		expect(Object.keys(defaults)).toEqual(['computeDefaults']);
	});
});

describe('scatterControls UI structure', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	function extractStructure(controls) {
		return controls.map(section => {
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
	}

	it('matches the section and control-order structure snapshot for each color mode', () => {
		// Drive all three color modes: uniform omits both conditional styling
		// controls, numeric surfaces gradient-distribution, and category surfaces
		// color-scheme, so the snapshot pins each conditional's exact slot in the
		// marker -> color concat (not just its presence).
		const byMode = {};
		for (const colorMode of ['uniform', 'numeric', 'category']) {
			const dataset = createDataset({ colorMode });
			const controls = createScatterPlotControls(
				dataset,
				['value', 'otherValue'],
				['value', 'otherValue', 'category'],
			);
			byMode[colorMode] = extractStructure(controls);
		}

		expect(byMode).toMatchSnapshot();
	});
});

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

	it('renders numeric color controls and disabled controls with configured fallbacks', () => {
		const dataset = createDataset({
			enabled: false,
			categoricalPairMode: '',
			colorMode: 'numeric',
			colorField: 'value',
			colorScheme: '',
			gradientDistribution: '',
			sizeMode: 'numeric',
			regression: { enabled: true, mode: 'perCategory', showCI: false, showEquation: false, showR2: false },
			strokeWidth: 0,
		});
		const controls = createScatterPlotControls(dataset, ['value'], ['category', 'value']);
		appendControls(controls);

		expect(document.getElementById('viz-select-scatter-gradient-distribution')).not.toBeNull();
		expect(document.getElementById('viz-select-scatter-color-scheme')).toBeNull();
		expect(document.getElementById('viz-select-scatter-categorical-mode').value).toBe('jitter');
		expect(document.querySelector('button[data-color-preset-control="viz-scatter-color-preset"][data-preset-name="Bold"]').style.cursor).toBe('not-allowed');
		expect(document.getElementById('viz-toggle-scatter-regression-ci').checked).toBe(false);
		expect(document.getElementById('viz-toggle-scatter-regression-mode')?.disabled).toBeUndefined();
	});

	it('renders category color controls with categorical field options', () => {
		const dataset = createDataset({
			colorMode: 'category',
			colorField: 'category',
			regression: { enabled: true, mode: 'perCategory' },
			x: 'value',
			y: 'otherValue',
		});
		const controls = createScatterPlotControls(dataset, ['value', 'otherValue'], ['category', 'value', 'otherValue']);
		appendControls(controls);

		const colorFieldValues = Array.from(document.getElementById('viz-select-scatter-color-field').options).map(option => option.value);
		expect(colorFieldValues).toEqual(['', 'category']);
		expect(document.getElementById('viz-select-scatter-color-scheme')).not.toBeNull();
		expect(document.getElementById('viz-select-scatter-regression-mode').disabled).toBe(false);
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

		const writer = createWriter();
		setupScatterPlotControlListeners(dataset, ['value'], ['category', 'value'], writer);

		const xSelect = document.getElementById('viz-select-x');
		xSelect.value = 'category';
		xSelect.dispatchEvent(new Event('change', { bubbles: true }));

		expect(writer.commit).toHaveBeenCalledWith(expect.objectContaining({
				x: 'category',
				xScale: 'linear',
			}));
		expect(writer.commit).toHaveBeenCalledTimes(1);
	});

	it('prevents selecting log scale for a categorical axis', () => {
		const dataset = createDataset({ x: 'category', xScale: 'linear' });
		const controls = createScatterPlotControls(dataset, ['value'], ['category', 'value']);
		appendControls(controls);

		const writer = createWriter();
		setupScatterPlotControlListeners(dataset, ['value'], ['category', 'value'], writer);

		const xScale = document.getElementById('viz-select-scatter-xscale');
		xScale.value = 'log';
		xScale.dispatchEvent(new Event('change', { bubbles: true }));

		expect(writer.commit).toHaveBeenCalledWith(expect.objectContaining({
				xScale: 'linear',
			}));
		expect(writer.commit).toHaveBeenCalledTimes(1);
	});

	it('stores categorical pairing mode updates', () => {
		const dataset = createDataset({ x: 'category', y: 'group', categoricalPairMode: 'jitter' });
		const controls = createScatterPlotControls(dataset, ['value'], ['category', 'group', 'value']);
		appendControls(controls);

		const writer = createWriter();
		setupScatterPlotControlListeners(dataset, ['value'], ['category', 'group', 'value'], writer);

		const pairMode = document.getElementById('viz-select-scatter-categorical-mode');
		pairMode.value = 'aggregate';
		pairMode.dispatchEvent(new Event('change', { bubbles: true }));

		expect(writer.commit).toHaveBeenCalledWith(expect.objectContaining({
				categoricalPairMode: 'aggregate',
			}));
		expect(writer.commit).toHaveBeenCalledTimes(1);
	});

	it('safely skips listener setup when controls are absent', () => {
		const dataset = createDataset();
		const writer = createWriter();

		expect(() => setupScatterPlotControlListeners(dataset, ['value'], ['category', 'value'], writer)).not.toThrow();
		expect(writer.commit).not.toHaveBeenCalled();
	});

	it('stores valid numeric axis selections and falls back invalid axes to null', () => {
		const dataset = createDataset({ x: 'value', y: 'otherValue', xScale: 'log', yScale: 'weird' });
		const controls = createScatterPlotControls(dataset, ['value', 'otherValue'], ['category', 'value', 'otherValue']);
		appendControls(controls);

		const writer = createWriter();
		setupScatterPlotControlListeners(dataset, ['value', 'otherValue'], ['category', 'value', 'otherValue'], writer);

		selectValue('viz-select-y', 'value');
		expect(lastConfig(writer)).toEqual(expect.objectContaining({ y: 'value', yScale: 'linear' }));

		selectValue('viz-select-x', 'missing');
		expect(lastConfig(writer)).toEqual(expect.objectContaining({ x: null, xScale: 'linear' }));
	});

	it('coerces simple select values through their validation transforms', () => {
		const dataset = createDataset({ x: 'value', y: 'otherValue', sizeMode: 'numeric' });
		const controls = createScatterPlotControls(dataset, ['value', 'otherValue'], ['category', 'value', 'otherValue']);
		appendControls(controls);

		const writer = createWriter();
		setupScatterPlotControlListeners(dataset, ['value', 'otherValue'], ['category', 'value', 'otherValue'], writer);

		selectValue('viz-select-scatter-xscale', 'log');
		expect(lastConfig(writer).xScale).toBe('log');

		selectValue('viz-select-scatter-yscale', 'log');
		expect(lastConfig(writer).yScale).toBe('log');

		selectValue('viz-select-scatter-size-mode', 'unexpected');
		expect(lastConfig(writer).sizeMode).toBe('uniform');

		selectValue('viz-select-scatter-size-field', 'otherValue');
		expect(lastConfig(writer).sizeField).toBe('otherValue');

		selectValue('viz-select-scatter-size-field', 'category');
		expect(lastConfig(writer).sizeField).toBeNull();

		selectValue('viz-select-scatter-categorical-mode', 'invalid');
		expect(lastConfig(writer).categoricalPairMode).toBe('jitter');

		selectValue('viz-select-scatter-color-field', '');
		expect(lastConfig(writer).colorField).toBeNull();
	});

	it('updates color mode dependencies for uniform, numeric, and category selections', () => {
		const dataset = createDataset({
			colorMode: 'uniform',
			colorField: 'old',
			regression: { enabled: true, mode: 'perCategory' },
		});
		const controls = createScatterPlotControls(dataset, ['value', 'otherValue'], ['category', 'group', 'value', 'otherValue']);
		appendControls(controls);

		const writer = createWriter();
		setupScatterPlotControlListeners(dataset, ['value', 'otherValue'], ['category', 'group', 'value', 'otherValue'], writer);

		selectValue('viz-select-scatter-color-mode', 'category');
		expect(lastConfig(writer)).toEqual(expect.objectContaining({
			colorMode: 'category',
			colorField: 'category',
			colorFieldType: 'category',
			regression: expect.objectContaining({ mode: 'perCategory' }),
		}));

		dataset.chartConfig.scatter.colorField = 'otherValue';
		selectValue('viz-select-scatter-color-mode', 'numeric');
		expect(lastConfig(writer)).toEqual(expect.objectContaining({
			colorMode: 'numeric',
			colorField: 'otherValue',
			colorFieldType: 'numeric',
			regression: expect.objectContaining({ mode: 'overall' }),
		}));

		selectValue('viz-select-scatter-color-mode', 'uniform');
		expect(lastConfig(writer)).toEqual(expect.objectContaining({
			colorMode: 'uniform',
			colorField: null,
			colorFieldType: null,
		}));
		expect(writer.commit).toHaveBeenCalledTimes(3);
	});

	it('routes color input previews and committed values through the writer', () => {
		const dataset = createDataset({ colorMode: 'numeric', colorField: 'value' });
		const controls = createScatterPlotControls(dataset, ['value'], ['category', 'value']);
		appendControls(controls);

		const writer = createWriter();
		setupScatterPlotControlListeners(dataset, ['value'], ['category', 'value'], writer);

		const colorInput = document.getElementById('viz-input-scatter-color');
		colorInput.value = '#abcdef';
		colorInput.dispatchEvent(new Event('input', { bubbles: true }));

		// Preview on input, never commit: emitting mid-drag would rebuild the
		// sidebar and steal focus from the open picker.
		expect(writer.commit).not.toHaveBeenCalled();
		expect(writer.preview).toHaveBeenCalledTimes(1);
		expect(writer.preview.mock.calls[0][0]).toEqual(expect.objectContaining({
			colorMode: 'uniform',
			colorField: null,
			colorFieldType: null,
			color: '#abcdef',
		}));

		colorInput.value = '#123456';
		colorInput.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer)).toEqual(expect.objectContaining({
			colorMode: 'uniform',
			colorField: null,
			color: '#123456',
		}));
	});

	it('applies gradient, palette, checkbox, text, and slider listeners', () => {
		const dataset = createDataset({ colorMode: 'numeric', gradientDistribution: 'value', sizeMode: 'numeric' });
		const controls = createScatterPlotControls(dataset, ['value'], ['category', 'value']);
		appendControls(controls);

		const writer = createWriter();
		setupScatterPlotControlListeners(dataset, ['value'], ['category', 'value'], writer);

		selectValue('viz-select-scatter-gradient-distribution', 'rank');
		expect(lastConfig(writer).gradientDistribution).toBe('rank');

		selectValue('viz-select-scatter-gradient-distribution', 'unknown');
		expect(lastConfig(writer).gradientDistribution).toBe('value');

		document.querySelector('button[data-color-preset-control="viz-scatter-color-preset"][data-preset-name="Pastel"]').click();
		expect(lastConfig(writer)).toEqual(expect.objectContaining({
			colorScheme: 'Pastel',
			color: expect.stringMatching(/^#[0-9a-f]{6}$/i),
			gradientMinColor: expect.stringMatching(/^#[0-9a-f]{6}$/i),
			gradientMaxColor: expect.stringMatching(/^#[0-9a-f]{6}$/i),
		}));

		const xLabel = document.getElementById('viz-toggle-scatter-x-label');
		xLabel.checked = false;
		xLabel.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer).showXAxisLabel).toBe(false);

		const title = document.getElementById('viz-input-scatter-title');
		title.value = '  Custom scatter  ';
		title.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer).customTitle).toBe('Custom scatter');

		const min = document.getElementById('viz-slider-scatter-size-min');
		min.value = '7';
		min.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer).sizeMin).toBe(7);
	});

	it('updates regression toggles and per-category mode dependencies', () => {
		const dataset = createDataset({ x: 'value', y: 'otherValue', colorMode: 'uniform', colorField: null });
		const controls = createScatterPlotControls(dataset, ['value', 'otherValue'], ['category', 'value', 'otherValue']);
		appendControls(controls);

		const writer = createWriter();
		setupScatterPlotControlListeners(dataset, ['value', 'otherValue'], ['category', 'value', 'otherValue'], writer);

		const enabled = document.getElementById('viz-toggle-scatter-regression-enabled');
		enabled.checked = true;
		enabled.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer).regression.enabled).toBe(true);

		selectValue('viz-select-scatter-regression-mode', 'perCategory');
		expect(lastConfig(writer)).toEqual(expect.objectContaining({
			colorMode: 'category',
			colorField: 'category',
			colorFieldType: 'category',
			regression: expect.objectContaining({ mode: 'perCategory' }),
		}));

		selectValue('viz-select-scatter-regression-mode', 'invalid');
		expect(lastConfig(writer).regression.mode).toBe('overall');
	});

	it('keeps per-category regression from replacing an existing category field', () => {
		const dataset = createDataset({
			x: 'value',
			y: 'otherValue',
			colorMode: 'category',
			colorField: 'group',
			colorFieldType: 'category',
		});
		const controls = createScatterPlotControls(dataset, ['value', 'otherValue'], ['category', 'group', 'value', 'otherValue']);
		appendControls(controls);

		const writer = createWriter();
		setupScatterPlotControlListeners(dataset, ['value', 'otherValue'], ['category', 'group', 'value', 'otherValue'], writer);

		selectValue('viz-select-scatter-regression-mode', 'perCategory');
		// The patch touches regression only. Because it names neither colorMode
		// nor colorField, the adapter's merge cannot clobber the existing
		// category color field, which is what this guards.
		expect(lastConfig(writer)).toEqual({
			regression: expect.objectContaining({ mode: 'perCategory' }),
		});
	});

	it('uses empty scatter objects when regression listeners run without existing config', () => {
		const dataset = { chartConfig: { scatter: null } };
		document.body.innerHTML = '<input id="viz-toggle-scatter-regression-ci" type="checkbox">';

		const writer = createWriter();
		setupScatterPlotControlListeners(dataset, [], [], writer);
		const checkbox = document.getElementById('viz-toggle-scatter-regression-ci');
		checkbox.checked = false;
		checkbox.dispatchEvent(new Event('change', { bubbles: true }));

		expect(lastConfig(writer)).toEqual({ regression: { showCI: false } });
	});
});

describe('scatterControls computeDefaults', () => {
	it('preserves current visible selections and log scales for numeric axes', () => {
		const dataset = createDataset({ x: 'value', y: 'otherValue', xScale: 'log', yScale: 'log' });

		expect(computeDefaults(dataset, {
			numeric: ['value', 'otherValue'],
			allColumns: ['category', 'value', 'otherValue'],
		})).toEqual({ x: 'value', y: 'otherValue', xScale: 'log', yScale: 'log' });
	});

	it('falls back across numeric, visible, and empty column sets', () => {
		expect(computeDefaults(createDataset({ x: 'old', y: 'oldY', xScale: 'log', yScale: 'log' }), {
			numeric: ['value'],
			allColumns: ['category', 'value'],
		})).toEqual({ x: 'value', y: 'category', xScale: 'log', yScale: 'linear' });

		expect(computeDefaults({ chartConfig: {} }, {
			numeric: [],
			allColumns: ['category'],
		})).toEqual({ x: 'category', y: 'category', xScale: 'linear', yScale: 'linear' });

		expect(computeDefaults({ chartConfig: {} }, {
			numeric: [],
			allColumns: [],
		})).toEqual({ x: null, y: null, xScale: 'linear', yScale: 'linear' });
	});
});
