// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BAR_CONTROLS } from '../../../src/charts/bar/controls/descriptions.js';
import { buildDescribedControls } from '../../../src/charts/shared/controls/describedControls.js';
import { COLOR_PRESETS } from '../../../src/charts/shared/controls/factories.js';
import { BAR_DEFINITION } from '../../../src/config/charts/definitions/bar.js';

/**
 * Writer test double. The controls' contract is that they hand the right
 * patch to the writer; merging it into state, firing onConfigChanged, and
 * live-rendering are the adapter's contract and are covered by
 * tests/features/datasetWorkspace/chartControls/chartConfigAdapter.test.js.
 */
function createWriter() {
	return { commit: vi.fn(), preview: vi.fn() };
}

function createDataset(overrides = {}) {
	return {
		chartConfig: {
			bar: {
				enabled: true,
				expanded: true,
				category: 'region',
				measureMode: 'count',
				valueColumn: null,
				sort: 'value-desc',
				topN: 0,
				customTitle: '',
				chartHeight: 320,
				showXAxisLabel: true,
				showYAxisLabel: true,
				colorMode: 'uniform',
				color: '#4e79a7',
				colorScheme: 'Bold',
				gradientMinColor: '#4e79a7',
				gradientMaxColor: '#ffffff',
				gradientDistribution: 'value',
				manualThresholdPct: 50,
				...overrides,
			},
		},
	};
}

function createContext({ categories = ['region'], numeric = ['sales'] } = {}) {
	return {
		baseCategoricalOrAll: categories,
		categorical: categories,
		numeric,
		allColumns: [...categories, ...numeric],
		dates: [],
		rows: [],
	};
}

function buildControls(dataset, writer = createWriter(), context = createContext(), translate = key => key) {
	return buildDescribedControls(BAR_CONTROLS, { dataset, context, writer, translate });
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
	Object.assign(dataset.chartConfig.bar, lastConfig(writer));
}

function presetButton(name) {
	return document.querySelector(`button[data-color-preset-control="viz-bar-color-preset"][data-preset-name="${name}"]`);
}

function markedPresets() {
	return [...document.querySelectorAll('button[data-color-preset-control="viz-bar-color-preset"]')]
		.filter(button => button.style.border.startsWith('2px'))
		.map(button => button.dataset.presetName);
}

const optionValues = id => Array.from(document.getElementById(id).options, option => option.value);

describe('bar controls module boundaries', () => {
	it('declares its controls as descriptions, with no builder or listener module', async () => {
		const descriptions = await import('../../../src/charts/bar/controls/descriptions.js');
		expect(Object.keys(descriptions)).toEqual(['BAR_CONTROLS']);
		expect(BAR_CONTROLS.definition).toBe(BAR_DEFINITION);
	});
});

describe('barControls section structure', () => {
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
		// controls, gradient surfaces gradient-distribution, and gradient-manual
		// surfaces the threshold slider, so the snapshot pins each conditional's
		// exact slot in the styling section (not just its presence).
		const byMode = {};
		for (const colorMode of ['uniform', 'gradient', 'gradient-manual']) {
			const dataset = createDataset({ colorMode });
			const context = createContext({ categories: ['region', 'team'] });
			byMode[colorMode] = extractStructure(buildControls(dataset, createWriter(), context));
		}

		expect(byMode).toMatchSnapshot();
	});
});

describe('barControls UI structure', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('offers categorical columns plus an empty (none) option in the category select', () => {
		mountControls(createDataset(), createWriter(), createContext({ categories: ['region', 'team'] }));

		expect(optionValues('viz-select-bar')).toEqual(['', 'region', 'team']);
	});

	it('offers the sorts, measures, color modes and gradient distributions the bar definition lists', () => {
		mountControls(createDataset({ colorMode: 'gradient' }));

		expect(optionValues('viz-select-bar-sort')).toEqual(BAR_DEFINITION.allowedValues.sort);
		expect(optionValues('viz-select-bar-measure')).toEqual(BAR_DEFINITION.allowedValues.measureMode);
		expect(optionValues('viz-select-bar-color-mode')).toEqual(BAR_DEFINITION.allowedValues.colorMode);
		expect(optionValues('viz-select-bar-gradient-distribution')).toEqual(BAR_DEFINITION.allowedValues.gradientDistribution);
	});

	it('names the measure in the labels of the orders that sort by it', () => {
		const translate = (key, ...params) => [key, ...params].join('|');
		mountControls(createDataset({ measureMode: 'sum' }), createWriter(), createContext(), translate);

		expect(Array.from(document.getElementById('viz-select-bar-sort').options, option => option.textContent)).toEqual([
			'chive-chart-sort-measure-desc|chive-tooltip-sum',
			'chive-chart-sort-measure-asc|chive-tooltip-sum',
			'chive-chart-sort-label-asc',
			'chive-chart-sort-label-desc',
		]);
	});

	it('disables the gradient color pickers when colorMode is uniform, and the bar color otherwise', () => {
		mountControls(createDataset({ colorMode: 'uniform' }));
		expect(document.getElementById('viz-input-bar-color').disabled).toBe(false);
		expect(document.getElementById('viz-input-bar-gradient-min').disabled).toBe(true);
		expect(document.getElementById('viz-input-bar-gradient-max').disabled).toBe(true);

		mountControls(createDataset({ colorMode: 'gradient' }));
		expect(document.getElementById('viz-input-bar-color').disabled).toBe(true);
		expect(document.getElementById('viz-input-bar-gradient-min').disabled).toBe(false);
		expect(document.getElementById('viz-input-bar-gradient-max').disabled).toBe(false);
	});

	it.each([
		['uniform', false, false],
		['gradient', true, false],
		['gradient-manual', false, true],
	])('in colorMode %s, shows the gradient distribution: %s, the manual threshold: %s', (colorMode, distribution, threshold) => {
		mountControls(createDataset({ colorMode }));

		expect(document.getElementById('viz-select-bar-gradient-distribution') !== null).toBe(distribution);
		expect(document.getElementById('viz-slider-bar-threshold') !== null).toBe(threshold);
	});

	it('shows the default threshold for a threshold of 0 or none', () => {
		mountControls(createDataset({ colorMode: 'gradient-manual', manualThresholdPct: 0 }));
		expect(document.getElementById('viz-slider-bar-threshold').value).toBe('50');

		mountControls(createDataset({ colorMode: 'gradient-manual', manualThresholdPct: 35 }));
		expect(document.getElementById('viz-slider-bar-threshold').value).toBe('35');
	});

	it('disables every control while the chart is off', () => {
		mountControls(createDataset({ enabled: false, colorMode: 'gradient' }));

		const states = [...document.querySelectorAll('select, input, button[data-preset-name]')].map(element => element.disabled);
		expect(states.length).toBeGreaterThan(0);
		expect(states.every(Boolean)).toBe(true);
	});
});

describe('barControls writes', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('commits a measureMode change and keeps a valid valueColumn', () => {
		const writer = mountControls(createDataset({ measureMode: 'count', valueColumn: 'sales' }));

		selectValue('viz-select-bar-measure', 'sum');

		expect(writer.commit).toHaveBeenCalledWith({ measureMode: 'sum', valueColumn: 'sales' });
		expect(writer.commit).toHaveBeenCalledTimes(1);
	});

	it('keeps valueColumn when measureMode switches to count', () => {
		const writer = mountControls(createDataset({ measureMode: 'sum', valueColumn: 'sales' }));

		selectValue('viz-select-bar-measure', 'count');

		expect(writer.commit).toHaveBeenCalledWith({ measureMode: 'count', valueColumn: 'sales' });
	});

	it('takes the first numeric column when switching to mean without a usable valueColumn', () => {
		const writer = mountControls(
			createDataset({ measureMode: 'count', valueColumn: 'hidden' }),
			createWriter(),
			createContext({ numeric: ['sales', 'profit'] }),
		);

		selectValue('viz-select-bar-measure', 'mean');

		expect(writer.commit).toHaveBeenCalledWith({ measureMode: 'mean', valueColumn: 'sales' });
	});

	it('commits the category as chosen, the empty string for none', () => {
		const writer = mountControls(createDataset(), createWriter(), createContext({ categories: ['region', 'team'] }));

		selectValue('viz-select-bar', 'team');
		expect(lastConfig(writer)).toEqual({ category: 'team' });
		selectValue('viz-select-bar', '');
		expect(lastConfig(writer)).toEqual({ category: '' });
	});

	// The commit canonicalizes the chart's config, which replaces a sort, color
	// mode or gradient distribution the bar does not offer.
	it('commits forged enumerated selections as chosen', () => {
		const writer = mountControls(createDataset({ colorMode: 'gradient' }));

		selectValue('viz-select-bar-color-mode', 'gibberish');
		expect(lastConfig(writer)).toEqual({ colorMode: 'gibberish' });
		selectValue('viz-select-bar-sort', 'sideways');
		expect(lastConfig(writer)).toEqual({ sort: 'sideways' });
		selectValue('viz-select-bar-gradient-distribution', 'rank');
		expect(lastConfig(writer)).toEqual({ gradientDistribution: 'rank' });
	});

	it('transforms Top N from string to number', () => {
		const writer = mountControls(createDataset({ topN: 0 }));

		selectValue('viz-select-bar-topn', '20');

		expect(writer.commit).toHaveBeenCalledTimes(1);
		expect(lastConfig(writer)).toEqual({ topN: 20 });
	});

	it('commits the title trimmed and the axis-label toggles', () => {
		const writer = mountControls(createDataset({ showXAxisLabel: true }));

		const title = document.getElementById('viz-input-bar-title');
		title.value = '  Sales by region  ';
		title.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer)).toEqual({ customTitle: 'Sales by region' });

		document.getElementById('viz-toggle-bar-x-label').click();
		expect(lastConfig(writer)).toEqual({ showXAxisLabel: false });
		document.getElementById('viz-toggle-bar-y-label').click();
		expect(lastConfig(writer)).toEqual({ showYAxisLabel: false });
	});

	it('previews a bar color while the picker is open and commits it when it closes', () => {
		const writer = mountControls(createDataset({ colorMode: 'uniform' }));
		const input = document.getElementById('viz-input-bar-color');

		input.value = '#123456';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		expect(writer.preview).toHaveBeenCalledWith({ color: '#123456' });
		expect(writer.commit).not.toHaveBeenCalled();

		input.dispatchEvent(new Event('change', { bubbles: true }));
		expect(writer.commit).toHaveBeenCalledWith({ color: '#123456' });
	});

	it('writes the gradient colors, and the white fallback for an invalid light end', () => {
		const writer = mountControls(createDataset({ colorMode: 'gradient' }));

		const min = document.getElementById('viz-input-bar-gradient-min');
		min.value = '#abcdef';
		min.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer)).toEqual({ gradientMinColor: '#abcdef' });

		const max = document.getElementById('viz-input-bar-gradient-max');
		max.type = 'text';
		max.value = 'not-a-color';
		max.dispatchEvent(new Event('input', { bubbles: true }));
		expect(writer.preview).toHaveBeenLastCalledWith({ gradientMaxColor: '#ffffff' });
	});

	it('follows the threshold drag in its output and commits a number on release', () => {
		const writer = mountControls(createDataset({ colorMode: 'gradient-manual' }));
		const slider = document.getElementById('viz-slider-bar-threshold');

		slider.value = '65';
		slider.dispatchEvent(new Event('input', { bubbles: true }));
		expect(slider.parentElement.querySelector('output').textContent).toBe('65');
		expect(writer.commit).not.toHaveBeenCalled();

		slider.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer)).toEqual({ manualThresholdPct: 65 });
	});

	it('copies a palette into the bar and gradient colors', () => {
		const writer = mountControls(createDataset());

		presetButton('Bold').click();

		expect(writer.commit).toHaveBeenCalledWith({
			colorScheme: 'Bold',
			color: COLOR_PRESETS.Bold[0],
			gradientMinColor: COLOR_PRESETS.Bold[0],
			gradientMaxColor: COLOR_PRESETS.Bold.at(-1),
		});
	});
});

describe('barControls color palette mark', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('marks no palette on a new chart', () => {
		const { color, colorScheme, gradientMinColor, gradientMaxColor } = BAR_DEFINITION.createDefaultConfig();
		mountControls(createDataset({ color, colorScheme, gradientMinColor, gradientMaxColor }));

		expect(markedPresets()).toEqual([]);
	});

	it('marks a palette once its button applies it, until a bar color is edited', () => {
		const dataset = createDataset();
		const writer = createWriter();
		mountControls(dataset, writer);

		presetButton('Colorblind-Safe').click();
		applyLastCommit(dataset, writer);
		mountControls(dataset, writer);
		expect(markedPresets()).toEqual(['Colorblind-Safe']);

		const colorInput = document.getElementById('viz-input-bar-color');
		colorInput.value = '#ff0000';
		colorInput.dispatchEvent(new Event('change'));
		applyLastCommit(dataset, writer);
		mountControls(dataset, writer);
		expect(markedPresets()).toEqual([]);
	});
});
