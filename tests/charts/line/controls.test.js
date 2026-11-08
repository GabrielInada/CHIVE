// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LINE_CONTROLS } from '../../../src/charts/line/controls/descriptions.js';
import { computeDefaults } from '../../../src/charts/line/controls/activationDefaults.js';
import { buildDescribedControls } from '../../../src/charts/shared/controls/describedControls.js';
import { LINE_DEFINITION } from '../../../src/config/charts/definitions/line.js';

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

function createContext({ allColumns = ['month', 'visits', 'signups'], numeric = ['visits', 'signups'], dates = ['month'] } = {}) {
	const categorical = allColumns.filter(column => !numeric.includes(column));
	return {
		allColumns,
		numeric,
		categorical,
		baseCategoricalOrAll: categorical.length > 0 ? categorical : allColumns,
		dates,
		rows: [],
	};
}

function buildControls(dataset, writer = createWriter(), context = createContext(), translate = key => key) {
	return buildDescribedControls(LINE_CONTROLS, { dataset, context, writer, translate });
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

const optionValues = id => Array.from(document.getElementById(id).options, option => option.value);
const optionLabels = id => Array.from(document.getElementById(id).options, option => option.textContent);

function extractStructure(controls) {
	return controls.map(section => {
		const content = section.querySelector('.chart-section-content');
		const controlKeys = Array.from(content.children).map(control => {
			const idElement = control.matches('[id]') ? control : control.querySelector('[id]');
			const presetElement = control.querySelector('[data-color-preset-control]');
			const stateElement = idElement ?? presetElement ?? control.querySelector('button,input,select');
			const entry = {
				id: idElement?.id ?? presetElement?.dataset.colorPresetControl,
				disabled: stateElement?.disabled === true,
			};
			expect(entry.id).toBeDefined();
			return entry;
		});

		return {
			section: section.dataset.section,
			expanded: section.querySelector('.chart-section-header').getAttribute('aria-expanded'),
			controlKeys,
		};
	});
}

describe('line controls module boundaries', () => {
	it('declares its controls as descriptions, with no builder or listener module', async () => {
		const [descriptions, defaults] = await Promise.all([
			import('../../../src/charts/line/controls/descriptions.js'),
			import('../../../src/charts/line/controls/activationDefaults.js'),
		]);
		expect(Object.keys(descriptions)).toEqual(['LINE_CONTROLS']);
		expect(Object.keys(defaults)).toEqual(['computeDefaults']);
		expect(LINE_CONTROLS.definition).toBe(LINE_DEFINITION);
	});
});

describe('lineControls section structure', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('matches the section/control-order and disabled-state snapshot across missing modes', () => {
		// Drive the missingMode dimension: 'interpolate' enables the ghost-color
		// picker, every other mode disables it, so the snapshot pins that
		// conditional disabled slot (not just control presence/order).
		const byMode = {};
		for (const missingMode of ['interpolate', 'connect']) {
			byMode[missingMode] = extractStructure(buildControls(createDataset({ missingMode })));
		}

		expect(byMode).toMatchSnapshot();
	});
});

describe('lineControls UI structure', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('offers every visible column as X and only numeric columns as Y', () => {
		mountControls(createDataset());

		expect(optionValues('viz-select-line-x')).toEqual(['', 'month', 'visits', 'signups']);
		expect(optionValues('viz-select-line-y')).toEqual(['', 'visits', 'signups']);
	});

	it('offers the aggregations, curves and missing-value modes the line definition lists, each with its label', () => {
		mountControls(createDataset());

		expect(optionValues('viz-select-line-aggregate')).toEqual(LINE_DEFINITION.allowedValues.aggregateMode);
		expect(optionValues('viz-select-line-curve')).toEqual(LINE_DEFINITION.allowedValues.curve);
		expect(optionValues('viz-select-line-missing')).toEqual(LINE_DEFINITION.allowedValues.missingMode);
		expect(optionLabels('viz-select-line-aggregate')).toEqual(LINE_DEFINITION.allowedValues.aggregateMode.map(mode => `chive-chart-line-aggregate-${mode}`));
		expect(optionLabels('viz-select-line-curve')).toEqual(LINE_DEFINITION.allowedValues.curve.map(curve => `chive-chart-line-curve-${curve}`));
		expect(optionLabels('viz-select-line-missing')).toEqual(LINE_DEFINITION.allowedValues.missingMode.map(mode => `chive-chart-line-missing-${mode}`));
	});

	it('shows "None" for an unset X or Y, even beside columns named "null" and "undefined"', () => {
		mountControls(
			createDataset({ x: null, y: undefined }),
			createWriter(),
			createContext({ allColumns: ['null', 'undefined'], numeric: ['undefined'] }),
		);

		expect(document.getElementById('viz-select-line-x').selectedIndex).toBe(0);
		expect(document.getElementById('viz-select-line-y').selectedIndex).toBe(0);
	});

	it('disables the ghost color picker when missing mode is not interpolate', () => {
		mountControls(createDataset({ missingMode: 'connect' }));
		expect(document.getElementById('viz-input-line-ghost-color').disabled).toBe(true);

		mountControls(createDataset({ missingMode: 'interpolate' }));
		expect(document.getElementById('viz-input-line-ghost-color').disabled).toBe(false);
	});

	it('shows the default stroke width for a width of 0 and sorts X unless sorting is turned off', () => {
		mountControls(createDataset({ strokeWidth: 0, showPoints: true, sortX: undefined }));

		expect(document.getElementById('viz-slider-line-stroke-width').value).toBe('1.5');
		expect(document.getElementById('viz-toggle-line-show-points').checked).toBe(true);
		expect(document.getElementById('viz-toggle-line-sort-x').checked).toBe(true);

		mountControls(createDataset({ sortX: false }));
		expect(document.getElementById('viz-toggle-line-sort-x').checked).toBe(false);
	});

	it('gives the stroke width slider its range', () => {
		mountControls(createDataset());

		const slider = document.getElementById('viz-slider-line-stroke-width');
		expect([slider.min, slider.max, slider.step]).toEqual(['0.5', '6', '0.5']);
	});

	it('disables every control while the chart is off', () => {
		mountControls(createDataset({ enabled: false, missingMode: 'interpolate' }));

		const states = [...document.querySelectorAll('select, input')].map(element => element.disabled);
		expect(states).toHaveLength(13);
		expect(states.every(Boolean)).toBe(true);
	});
});

describe('lineControls writes', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('updates curve when the user changes the curve select', () => {
		const writer = mountControls(createDataset());

		selectValue('viz-select-line-curve', 'monotone');

		expect(writer.commit).toHaveBeenCalledWith({ curve: 'monotone' });
		expect(writer.commit).toHaveBeenCalledTimes(1);
	});

	// The commit canonicalizes the chart's config, which replaces a value the
	// line chart does not offer.
	it('commits forged curve, missing, and aggregate options as chosen', () => {
		const writer = mountControls(createDataset());

		selectValue('viz-select-line-curve', 'made-up');
		expect(lastConfig(writer)).toEqual({ curve: 'made-up' });

		selectValue('viz-select-line-missing', 'made-up');
		expect(lastConfig(writer)).toEqual({ missingMode: 'made-up' });

		selectValue('viz-select-line-aggregate', 'made-up');
		expect(lastConfig(writer)).toEqual({ aggregateMode: 'made-up' });
	});

	it('stores null for a Y that is not a numeric column, "None" included', () => {
		const writer = mountControls(createDataset());

		selectValue('viz-select-line-y', '');
		expect(lastConfig(writer)).toEqual({ y: null });

		selectValue('viz-select-line-y', 'month');
		expect(lastConfig(writer)).toEqual({ y: null });
	});

	it('updates X/Y selections for valid values and coerces invalid X to null', () => {
		const writer = mountControls(createDataset());

		selectValue('viz-select-line-x', 'signups');
		expect(lastConfig(writer)).toEqual({ x: 'signups' });

		selectValue('viz-select-line-y', 'signups');
		expect(lastConfig(writer)).toEqual({ y: 'signups' });

		selectValue('viz-select-line-x', 'missing');
		expect(lastConfig(writer)).toEqual({ x: null });
		expect(writer.commit).toHaveBeenCalledTimes(3);
	});

	it('toggles sortX, the points and the axis labels through their checkboxes', () => {
		const writer = mountControls(createDataset());

		document.getElementById('viz-toggle-line-sort-x').click();
		expect(lastConfig(writer)).toEqual({ sortX: false });
		document.getElementById('viz-toggle-line-show-points').click();
		expect(lastConfig(writer)).toEqual({ showPoints: true });
		document.getElementById('viz-toggle-line-x-label').click();
		expect(lastConfig(writer)).toEqual({ showXAxisLabel: false });
		document.getElementById('viz-toggle-line-y-label').click();
		expect(lastConfig(writer)).toEqual({ showYAxisLabel: false });
	});

	it('follows the stroke width drag in its output and commits a number on release', () => {
		const writer = mountControls(createDataset());
		const slider = document.getElementById('viz-slider-line-stroke-width');

		slider.value = '3.5';
		slider.dispatchEvent(new Event('input', { bubbles: true }));
		expect(slider.parentElement.querySelector('output').textContent).toBe('3.5');
		expect(writer.commit).not.toHaveBeenCalled();

		slider.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer)).toEqual({ strokeWidth: 3.5 });
	});

	it('previews the line color while the picker is open and commits it when it closes', () => {
		const writer = mountControls(createDataset());
		const input = document.getElementById('viz-input-line-color');

		input.value = '#123456';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		expect(writer.preview).toHaveBeenCalledWith({ color: '#123456' });
		expect(writer.commit).not.toHaveBeenCalled();

		input.dispatchEvent(new Event('change', { bubbles: true }));
		expect(writer.commit).toHaveBeenCalledWith({ color: '#123456' });
	});

	it('writes the default ghost color in place of an invalid one', () => {
		const writer = mountControls(createDataset({ missingMode: 'interpolate' }));
		const input = document.getElementById('viz-input-line-ghost-color');

		input.type = 'text';
		input.value = 'not-a-color';
		input.dispatchEvent(new Event('change', { bubbles: true }));

		expect(lastConfig(writer)).toEqual({ ghostStrokeColor: '#cccccc' });
	});

	it('commits the title trimmed', () => {
		const writer = mountControls(createDataset());
		const title = document.getElementById('viz-input-line-title');

		title.value = '  Visits by month  ';
		title.dispatchEvent(new Event('change', { bubbles: true }));

		expect(lastConfig(writer)).toEqual({ customTitle: 'Visits by month' });
	});
});

describe('lineControls computeDefaults', () => {
	it('preserves visible current values when they remain valid', () => {
		const dataset = createDataset({ x: 'month', y: 'visits' });

		expect(computeDefaults(dataset, {
			allColumns: ['month', 'visits'],
			dates: ['month'],
			numeric: ['visits'],
		})).toEqual({ x: 'month', y: 'visits' });
	});

	it('falls back through date, numeric, all-column, and empty defaults', () => {
		expect(computeDefaults(createDataset({ x: 'old', y: 'oldY' }), {
			allColumns: ['month', 'visits', 'signups'],
			dates: ['month'],
			numeric: ['visits', 'signups'],
		})).toEqual({ x: 'month', y: 'visits' });

		expect(computeDefaults(createDataset({ x: 'old', y: 'visits' }), {
			allColumns: ['visits', 'signups'],
			dates: [],
			numeric: ['visits', 'signups'],
		})).toEqual({ x: 'visits', y: 'signups' });

		expect(computeDefaults({ chartConfig: {} }, {
			allColumns: ['category'],
			dates: [],
			numeric: [],
		})).toEqual({ x: 'category', y: null });

		expect(computeDefaults({ chartConfig: {} }, {
			allColumns: [],
			dates: [],
			numeric: [],
		})).toEqual({ x: null, y: null });
	});
});
