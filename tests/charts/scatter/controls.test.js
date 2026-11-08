// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SCATTER_CONTROLS } from '../../../src/charts/scatter/controls/descriptions.js';
import { computeDefaults } from '../../../src/charts/scatter/controls/activationDefaults.js';
import { buildDescribedControls } from '../../../src/charts/shared/controls/describedControls.js';
import { COLOR_PRESETS } from '../../../src/charts/shared/controls/factories.js';
import { CHART_COLORS } from '../../../src/config/charts/definitions.js';
import { SCATTER_DEFINITION, SCATTER_PLOT } from '../../../src/config/charts/definitions/scatter.js';

/**
 * Writer test double. The controls' contract is that they hand the right
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
				sizeMode: 'uniform',
				sizeField: null,
				sizeMin: 2,
				sizeMax: 12,
				color: '#1a472a',
				colorMode: 'uniform',
				colorField: null,
				colorFieldType: null,
				gradientMinColor: '#1a472a',
				gradientMaxColor: '#ffffff',
				gradientDistribution: 'value',
				colorScheme: 'Bold',
				showXAxisLabel: true,
				showYAxisLabel: true,
				customTitle: '',
				chartHeight: 320,
				regression: { ...SCATTER_DEFINITION.createDefaultConfig().regression },
				...scatterOverrides,
			},
		},
	};
}

/** A column context; every visible column that is not numeric counts as categorical. */
function createContext(numeric = ['value'], allColumns = ['category', ...numeric]) {
	const categorical = allColumns.filter(column => !numeric.includes(column));
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
	return buildDescribedControls(SCATTER_CONTROLS, { dataset, context, writer, translate });
}

/** Build the controls into the document, as the sidebar does after each commit. */
function mountControls(dataset, writer = createWriter(), context = createContext(), translate = undefined) {
	document.body.replaceChildren(...buildControls(dataset, writer, context, translate));
	return writer;
}

function selectValue(id, value) {
	const select = document.getElementById(id);
	if (![...select.options].some(option => option.value === value)) {
		select.append(new Option(value, value));
	}
	select.value = value;
	select.dispatchEvent(new Event('change', { bubbles: true }));
}

function lastConfig(writer) {
	return writer.commit.mock.calls.at(-1)[0];
}

function applyLastCommit(dataset, writer) {
	Object.assign(dataset.chartConfig.scatter, lastConfig(writer));
}

function presetButton(name) {
	return document.querySelector(`button[data-color-preset-control="viz-scatter-color-preset"][data-preset-name="${name}"]`);
}

function markedPresets() {
	return [...document.querySelectorAll('button[data-color-preset-control="viz-scatter-color-preset"]')]
		.filter(button => button.style.border.startsWith('2px'))
		.map(button => button.dataset.presetName);
}

const byId = id => document.getElementById(id);
const optionValues = id => Array.from(byId(id).options, option => option.value);
const optionLabels = id => Array.from(byId(id).options, option => option.textContent);

describe('scatter controls module boundaries', () => {
	it('declares its controls as descriptions, with no builder or listener module', async () => {
		const [descriptions, defaults] = await Promise.all([
			import('../../../src/charts/scatter/controls/descriptions.js'),
			import('../../../src/charts/scatter/controls/activationDefaults.js'),
		]);
		expect(Object.keys(descriptions)).toEqual(['SCATTER_CONTROLS']);
		expect(Object.keys(defaults)).toEqual(['computeDefaults']);
		expect(SCATTER_CONTROLS.definition).toBe(SCATTER_DEFINITION);
	});
});

describe('scatterControls UI structure', () => {
	beforeEach(() => {
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
			const controls = buildControls(
				createDataset({ colorMode }),
				createWriter(),
				createContext(['value', 'otherValue'], ['value', 'otherValue', 'category']),
			);
			byMode[colorMode] = extractStructure(controls);
		}

		expect(byMode).toMatchSnapshot();
	});

	it('translates every section title', () => {
		const controls = buildControls(createDataset(), createWriter(), createContext(), key => `[${key}]`);

		expect(controls.map(section => section.querySelector('.chart-section-title').textContent.trim()))
			.toEqual([
				'[chive-chart-control-section-data-aggregation]',
				'[chive-chart-control-section-display]',
				'[chive-chart-control-scatter-regression-section]',
				'[chive-chart-control-section-styling]',
			]);
	});
});

describe('scatterControls options', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('offers all visible columns for X and Y selectors', () => {
		mountControls(createDataset({ x: 'category', y: 'value' }));

		expect(optionValues('viz-select-x')).toEqual(['', 'category', 'value']);
		expect(optionValues('viz-select-y')).toEqual(['', 'category', 'value']);
	});

	it('offers the scales, size modes, pairings, color modes, distributions and palettes the scatter definition lists', () => {
		mountControls(createDataset({ colorMode: 'numeric' }));

		expect(optionValues('viz-select-scatter-xscale')).toEqual(SCATTER_DEFINITION.allowedValues.xScale);
		expect(optionValues('viz-select-scatter-yscale')).toEqual(SCATTER_DEFINITION.allowedValues.yScale);
		expect(optionValues('viz-select-scatter-categorical-mode')).toEqual(SCATTER_DEFINITION.allowedValues.categoricalPairMode);
		expect(optionValues('viz-select-scatter-size-mode')).toEqual(SCATTER_DEFINITION.allowedValues.sizeMode);
		expect(optionValues('viz-select-scatter-color-mode')).toEqual(SCATTER_DEFINITION.allowedValues.colorMode);
		expect(optionValues('viz-select-scatter-gradient-distribution')).toEqual(SCATTER_DEFINITION.allowedValues.gradientDistribution);
		expect(optionValues('viz-select-scatter-regression-mode')).toEqual(SCATTER_DEFINITION.allowedValues.regression.mode);

		mountControls(createDataset({ colorMode: 'category' }));
		expect(optionValues('viz-select-scatter-color-scheme')).toEqual(SCATTER_DEFINITION.allowedValues.colorScheme);
		expect(optionLabels('viz-select-scatter-color-scheme')).toEqual(Object.keys(COLOR_PRESETS));
	});

	it('offers the radius and opacity the scatter definition lists, the opacity as a percentage', () => {
		mountControls(createDataset());

		expect(optionValues('viz-select-scatter-radius')).toEqual(SCATTER_PLOT.radiusOptions.map(String));
		expect(optionLabels('viz-select-scatter-radius')).toEqual(['2', '3', '4', '6']);
		expect(optionValues('viz-select-scatter-opacity')).toEqual(['0.3', '0.5', '0.7', '1']);
		expect(optionLabels('viz-select-scatter-opacity')).toEqual(['30%', '50%', '70%', '100%']);
		expect(byId('viz-select-scatter-radius').value).toBe('3');
		expect(byId('viz-select-scatter-opacity').value).toBe('0.7');
	});

	it('offers numeric color fields, and in category mode every column that is not numeric, dates included', () => {
		// Even one the context does not list as categorical.
		const context = { ...createContext(['value', 'otherValue'], ['category', 'month', 'value', 'otherValue']), categorical: ['category'] };

		mountControls(createDataset({ colorMode: 'numeric' }), createWriter(), context);
		expect(optionValues('viz-select-scatter-color-field')).toEqual(['', 'value', 'otherValue']);

		mountControls(createDataset({ colorMode: 'category' }), createWriter(), context);
		expect(optionValues('viz-select-scatter-color-field')).toEqual(['', 'category', 'month']);
	});

	it('shows "None" for unset columns, even beside columns named "null" and "undefined"', () => {
		mountControls(
			createDataset({ x: null, y: undefined, colorMode: 'category', colorField: null, sizeMode: 'numeric', sizeField: undefined }),
			createWriter(),
			createContext(['undefined'], ['null', 'undefined']),
		);

		for (const id of ['viz-select-x', 'viz-select-y', 'viz-select-scatter-color-field', 'viz-select-scatter-size-field']) {
			expect(byId(id).selectedIndex, id).toBe(0);
		}
	});

	it('shows the default size range for sizes of 0, and each regression display toggle on unless it is turned off', () => {
		mountControls(createDataset({ sizeMode: 'numeric', sizeMin: 0, sizeMax: 0, regression: { enabled: true, showCI: false } }));

		expect(byId('viz-slider-scatter-size-min').value).toBe('2');
		expect(byId('viz-slider-scatter-size-max').value).toBe('12');
		expect(byId('viz-toggle-scatter-regression-enabled').checked).toBe(true);
		expect(byId('viz-toggle-scatter-regression-ci').checked).toBe(false);
		expect(byId('viz-toggle-scatter-regression-equation').checked).toBe(true);
		expect(byId('viz-toggle-scatter-regression-r2').checked).toBe(true);
	});
});

describe('scatterControls enable rules', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('disables the scale of an axis that is not numeric', () => {
		mountControls(createDataset({ x: 'category', y: 'value' }));

		expect(byId('viz-select-scatter-xscale').disabled).toBe(true);
		expect(byId('viz-select-scatter-yscale').disabled).toBe(false);
	});

	it('enables the categorical pairing only when both axes are categorical', () => {
		mountControls(createDataset({ x: 'category', y: 'value' }));
		expect(byId('viz-select-scatter-categorical-mode').disabled).toBe(true);

		mountControls(createDataset({ x: 'category', y: 'group' }), createWriter(), createContext(['value'], ['category', 'group', 'value']));
		expect(byId('viz-select-scatter-categorical-mode').disabled).toBe(false);
	});

	it('enables the size field and range only in numeric size mode', () => {
		const sizeControls = ['viz-select-scatter-size-field', 'viz-slider-scatter-size-min', 'viz-slider-scatter-size-max'];

		mountControls(createDataset({ sizeMode: 'uniform' }));
		expect(sizeControls.map(id => byId(id).disabled)).toEqual([true, true, true]);

		mountControls(createDataset({ sizeMode: 'numeric' }));
		expect(sizeControls.map(id => byId(id).disabled)).toEqual([false, false, false]);
	});

	it.each([
		['uniform', { field: true, color: false, gradient: true }],
		['numeric', { field: false, color: true, gradient: false }],
		['category', { field: false, color: true, gradient: false }],
	])('in color mode %s, disables %o', (colorMode, disabled) => {
		mountControls(createDataset({ colorMode }));

		expect(byId('viz-select-scatter-color-field').disabled).toBe(disabled.field);
		expect(byId('viz-input-scatter-color').disabled).toBe(disabled.color);
		expect(byId('viz-input-scatter-gradient-min').disabled).toBe(disabled.gradient);
		expect(byId('viz-input-scatter-gradient-max').disabled).toBe(disabled.gradient);
		expect(byId('viz-select-scatter-gradient-distribution') !== null).toBe(colorMode === 'numeric');
		expect(byId('viz-select-scatter-color-scheme') !== null).toBe(colorMode === 'category');
	});

	it('enables the regression only for two numeric axes, and its settings only while it is on', () => {
		const context = createContext(['value', 'otherValue'], ['category', 'value', 'otherValue']);
		const settings = ['viz-select-scatter-regression-mode', 'viz-toggle-scatter-regression-ci', 'viz-toggle-scatter-regression-equation', 'viz-toggle-scatter-regression-r2'];

		mountControls(createDataset({ x: 'category', y: 'value' }), createWriter(), context);
		expect(byId('viz-toggle-scatter-regression-enabled').disabled).toBe(true);

		mountControls(createDataset({ x: 'value', y: 'otherValue', regression: { enabled: false } }), createWriter(), context);
		expect(byId('viz-toggle-scatter-regression-enabled').disabled).toBe(false);
		expect(settings.map(id => byId(id).disabled)).toEqual([true, true, true, true]);

		mountControls(createDataset({ x: 'value', y: 'otherValue', regression: { enabled: true } }), createWriter(), context);
		expect(settings.map(id => byId(id).disabled)).toEqual([false, false, false, false]);
	});

	it('disables the per-category regression mode while no column is categorical', () => {
		mountControls(
			createDataset({ x: 'value', y: 'otherValue', regression: { enabled: true } }),
			createWriter(),
			createContext(['value', 'otherValue'], ['value', 'otherValue']),
		);

		expect(byId('viz-select-scatter-regression-mode').disabled).toBe(true);
	});

	it('disables every control while the chart is off', () => {
		mountControls(createDataset({ enabled: false, colorMode: 'numeric', sizeMode: 'numeric', regression: { enabled: true } }));

		const states = [...document.querySelectorAll('.chart-section-content :is(select, input, button)')].map(element => element.disabled);
		// 25 selects and inputs, and the palette buttons.
		expect(states).toHaveLength(25 + Object.keys(COLOR_PRESETS).length);
		expect(states.every(Boolean)).toBe(true);
	});
});

describe('scatterControls writes', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('resets the scale to linear when an axis turns categorical, and keeps it for a numeric one', () => {
		const writer = mountControls(
			createDataset({ x: 'value', y: 'otherValue', xScale: 'log', yScale: 'log' }),
			createWriter(),
			createContext(['value', 'otherValue'], ['category', 'value', 'otherValue']),
		);

		selectValue('viz-select-x', 'category');
		expect(lastConfig(writer)).toEqual({ x: 'category', xScale: 'linear' });

		selectValue('viz-select-y', 'value');
		expect(lastConfig(writer)).toEqual({ y: 'value', yScale: 'log' });

		selectValue('viz-select-x', 'missing');
		expect(lastConfig(writer)).toEqual({ x: null, xScale: 'linear' });
	});

	it('keeps the scale the config holds when the axis changes', () => {
		const dataset = createDataset({ x: 'value', xScale: 'linear' });
		const writer = mountControls(dataset, createWriter(), createContext(['value', 'otherValue'], ['value', 'otherValue']));

		dataset.chartConfig.scatter.xScale = 'log';
		selectValue('viz-select-x', 'otherValue');

		expect(lastConfig(writer)).toEqual({ x: 'otherValue', xScale: 'log' });
	});

	it('stores a linear scale for an axis that is not numeric when the event fires', () => {
		const dataset = createDataset({ x: 'value', xScale: 'linear' });
		const writer = mountControls(dataset);

		selectValue('viz-select-scatter-xscale', 'log');
		expect(lastConfig(writer)).toEqual({ xScale: 'log' });

		dataset.chartConfig.scatter.x = 'category';
		selectValue('viz-select-scatter-xscale', 'log');
		expect(lastConfig(writer)).toEqual({ xScale: 'linear' });
	});

	// The commit canonicalizes forged enumerated values.
	it('commits forged enums as chosen and checks field selections', () => {
		const writer = mountControls(
			createDataset({ x: 'value', y: 'otherValue', sizeMode: 'numeric' }),
			createWriter(),
			createContext(['value', 'otherValue'], ['category', 'value', 'otherValue']),
		);

		selectValue('viz-select-scatter-size-mode', 'unexpected');
		expect(lastConfig(writer)).toEqual({ sizeMode: 'unexpected' });

		selectValue('viz-select-scatter-size-field', 'otherValue');
		expect(lastConfig(writer)).toEqual({ sizeField: 'otherValue' });

		selectValue('viz-select-scatter-size-field', 'category');
		expect(lastConfig(writer)).toEqual({ sizeField: null });

		selectValue('viz-select-scatter-categorical-mode', 'invalid');
		expect(lastConfig(writer)).toEqual({ categoricalPairMode: 'invalid' });

		selectValue('viz-select-scatter-color-field', '');
		expect(lastConfig(writer)).toEqual({ colorField: null });
	});

	it('stores the radius and opacity as numbers', () => {
		const writer = mountControls(createDataset());

		selectValue('viz-select-scatter-radius', '6');
		expect(lastConfig(writer)).toEqual({ radius: 6 });
		selectValue('viz-select-scatter-opacity', '0.3');
		expect(lastConfig(writer)).toEqual({ opacity: 0.3 });
	});

	it('keeps a color field the new color mode can use, and resets the regression mode outside category mode', () => {
		const dataset = createDataset({
			colorMode: 'uniform',
			colorField: 'old',
			regression: { enabled: true, mode: 'perCategory' },
		});
		const writer = mountControls(dataset, createWriter(), createContext(['value', 'otherValue'], ['category', 'group', 'value', 'otherValue']));

		selectValue('viz-select-scatter-color-mode', 'category');
		expect(lastConfig(writer)).toEqual({
			colorMode: 'category',
			colorField: 'category',
			colorFieldType: 'category',
			regression: { enabled: true, mode: 'perCategory' },
		});

		dataset.chartConfig.scatter.colorField = 'otherValue';
		selectValue('viz-select-scatter-color-mode', 'numeric');
		expect(lastConfig(writer)).toEqual({
			colorMode: 'numeric',
			colorField: 'otherValue',
			colorFieldType: 'numeric',
			regression: { enabled: true, mode: 'overall' },
		});

		selectValue('viz-select-scatter-color-mode', 'uniform');
		expect(lastConfig(writer)).toEqual({
			colorMode: 'uniform',
			colorField: null,
			colorFieldType: null,
			regression: { enabled: true, mode: 'overall' },
		});
		expect(writer.commit).toHaveBeenCalledTimes(3);
	});

	it('colors the points uniformly while the point color is previewed and committed', () => {
		const writer = mountControls(createDataset({ colorMode: 'uniform' }));
		const colorInput = byId('viz-input-scatter-color');

		colorInput.value = '#abcdef';
		colorInput.dispatchEvent(new Event('input', { bubbles: true }));
		// Preview on input, never commit: emitting mid-drag would rebuild the
		// sidebar and steal focus from the open picker.
		expect(writer.commit).not.toHaveBeenCalled();
		expect(writer.preview.mock.calls).toEqual([[{ colorMode: 'uniform', colorField: null, colorFieldType: null, color: '#abcdef' }]]);

		colorInput.value = '#123456';
		colorInput.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer)).toEqual({ colorMode: 'uniform', colorField: null, colorFieldType: null, color: '#123456' });

		colorInput.type = 'text';
		colorInput.value = 'not-a-color';
		colorInput.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer).color).toBe(CHART_COLORS.scatter);
	});

	it('writes the gradient, the distribution, the palette, the labels, the title and the size range', () => {
		const writer = mountControls(createDataset({ colorMode: 'numeric', sizeMode: 'numeric' }));

		const max = byId('viz-input-scatter-gradient-max');
		max.type = 'text';
		max.value = 'not-a-color';
		max.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer)).toEqual({ gradientMaxColor: '#ffffff' });

		selectValue('viz-select-scatter-gradient-distribution', 'rank');
		expect(lastConfig(writer)).toEqual({ gradientDistribution: 'rank' });

		presetButton('Pastel').click();
		expect(lastConfig(writer)).toEqual({
			colorScheme: 'Pastel',
			color: COLOR_PRESETS.Pastel[0],
			gradientMinColor: COLOR_PRESETS.Pastel[0],
			gradientMaxColor: COLOR_PRESETS.Pastel.at(-1),
		});

		byId('viz-toggle-scatter-x-label').click();
		expect(lastConfig(writer)).toEqual({ showXAxisLabel: false });

		const title = byId('viz-input-scatter-title');
		title.value = '  Custom scatter  ';
		title.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer)).toEqual({ customTitle: 'Custom scatter' });

		const min = byId('viz-slider-scatter-size-min');
		min.value = '7';
		min.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer)).toEqual({ sizeMin: 7 });
	});

	it('writes the color scheme a category palette uses', () => {
		const writer = mountControls(createDataset({ colorMode: 'category', colorField: 'category' }));

		selectValue('viz-select-scatter-color-scheme', 'Tableau10');

		expect(lastConfig(writer)).toEqual({ colorScheme: 'Tableau10' });
	});

	it('writes each regression setting into the regression block of the moment', () => {
		const dataset = createDataset({ x: 'value', y: 'otherValue', regression: { enabled: true, mode: 'overall', lineWidth: 3 } });
		const writer = mountControls(dataset, createWriter(), createContext(['value', 'otherValue'], ['category', 'value', 'otherValue']));

		byId('viz-toggle-scatter-regression-enabled').click();
		expect(lastConfig(writer)).toEqual({ regression: { enabled: false, mode: 'overall', lineWidth: 3 } });

		dataset.chartConfig.scatter.regression = { enabled: true, showCI: true };
		byId('viz-toggle-scatter-regression-ci').click();
		expect(lastConfig(writer)).toEqual({ regression: { enabled: true, showCI: false } });

		dataset.chartConfig.scatter.regression = null;
		byId('viz-toggle-scatter-regression-r2').click();
		expect(lastConfig(writer)).toEqual({ regression: { showR2: false } });
	});

	it('colors the points by the first categorical column for per-category regression', () => {
		const writer = mountControls(
			createDataset({ x: 'value', y: 'otherValue', colorMode: 'uniform', colorField: null, regression: { enabled: true, mode: 'overall' } }),
			createWriter(),
			createContext(['value', 'otherValue'], ['category', 'value', 'otherValue']),
		);

		selectValue('viz-select-scatter-regression-mode', 'perCategory');
		expect(lastConfig(writer)).toEqual({
			regression: { enabled: true, mode: 'perCategory' },
			colorMode: 'category',
			colorField: 'category',
			colorFieldType: 'category',
		});

		selectValue('viz-select-scatter-regression-mode', 'invalid');
		expect(lastConfig(writer)).toEqual({ regression: { enabled: true, mode: 'invalid' } });
	});

	it('keeps per-category regression from replacing an existing category field', () => {
		const writer = mountControls(
			createDataset({
				x: 'value',
				y: 'otherValue',
				colorMode: 'category',
				colorField: 'group',
				colorFieldType: 'category',
				regression: { enabled: true, mode: 'overall' },
			}),
			createWriter(),
			createContext(['value', 'otherValue'], ['category', 'group', 'value', 'otherValue']),
		);

		selectValue('viz-select-scatter-regression-mode', 'perCategory');
		// The patch touches regression only. Because it names neither colorMode
		// nor colorField, the adapter's merge cannot clobber the existing
		// category color field, which is what this guards.
		expect(lastConfig(writer)).toEqual({ regression: { enabled: true, mode: 'perCategory' } });
	});
});

describe('scatterControls color palette mark', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('marks no palette on a new chart', () => {
		const { color, colorMode, colorScheme, gradientMinColor, gradientMaxColor } = SCATTER_DEFINITION.createDefaultConfig();
		mountControls(createDataset({ color, colorMode, colorScheme, gradientMinColor, gradientMaxColor }));

		expect(markedPresets()).toEqual([]);
	});

	it('marks a palette once its button applies it, until the point color is edited', () => {
		const dataset = createDataset();
		const writer = createWriter();
		mountControls(dataset, writer);

		presetButton('Colorblind-Safe').click();
		applyLastCommit(dataset, writer);
		mountControls(dataset, writer);
		expect(markedPresets()).toEqual(['Colorblind-Safe']);

		const colorInput = byId('viz-input-scatter-color');
		colorInput.value = '#123456';
		colorInput.dispatchEvent(new Event('change'));
		applyLastCommit(dataset, writer);
		mountControls(dataset, writer);
		expect(markedPresets()).toEqual([]);
	});

	it('marks the stored palette while a category field colors the points', () => {
		mountControls(createDataset({
			colorMode: 'category',
			colorField: 'category',
			colorFieldType: 'category',
			colorScheme: 'Tableau10',
		}));

		expect(markedPresets()).toEqual(['Tableau10']);
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
