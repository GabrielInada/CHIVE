// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { buildDescribedControls } from '../../../../src/charts/shared/controls/describedControls.js';
import { COLOR_PRESETS } from '../../../../src/charts/shared/controls/factories.js';

// Marks translated text, so a label that skipped translation shows.
const translate = (key, ...params) => `t(${[key, ...params].join(', ')})`;

const CONTEXT = {
	allColumns: ['region', 'team', 'sales', 'profit'],
	numeric: ['sales', 'profit'],
	categorical: ['region', 'team'],
	baseCategoricalOrAll: ['region', 'team'],
	dates: [],
	rows: [],
};

function chartWith(controls, allowedValues = {}) {
	return { definition: { key: 'demo', allowedValues }, sections: [{ id: 'main', title: 'Main', controls }] };
}

/**
 * Build into a root that is never attached to the document, so a control
 * that writes was wired as it was built, not found by id afterwards.
 */
function build(descriptions, config = {}, context = CONTEXT) {
	const dataset = { chartConfig: { demo: { enabled: true, ...config } } };
	const writer = { commit: vi.fn(), preview: vi.fn() };
	const root = document.createElement('div');
	root.append(...buildDescribedControls(descriptions, { dataset, context, writer, translate }));
	return { root, writer, dataset, get: id => root.querySelector(`#${id}`) };
}

function fire(element, type, value) {
	if (value !== undefined) element.value = value;
	element.dispatchEvent(new Event(type, { bubbles: true }));
}

// A click on a checkbox outside the document fires no change event, so flip it
// the way a click would and fire the event.
function toggle(checkbox) {
	checkbox.checked = !checkbox.checked;
	fire(checkbox, 'change');
}

const optionsOf = select => [...select.options].map(option => [option.value, option.textContent]);

describe('described control sections', () => {
	it('builds the sections in order, with their titles, expansion and icons', () => {
		const { root } = build({
			definition: { key: 'demo', allowedValues: {} },
			sections: [
				{ id: 'data', titleKey: 'chive-demo-data', expanded: true, icon: 'data', controls: [] },
				{ id: 'display', title: 'Display', expanded: false, controls: [] },
			],
		});

		const sections = [...root.children];
		expect(sections.map(section => section.dataset.section)).toEqual(['data', 'display']);
		expect(sections.map(section => section.querySelector('.chart-section-title').textContent.trim()))
			.toEqual(['t(chive-demo-data)', 'Display']);
		expect(sections.map(section => section.querySelector('.chart-section-header').getAttribute('aria-expanded')))
			.toEqual(['true', 'false']);
		expect(sections[0].querySelector('.svg-icon-data')).not.toBeNull();
		expect(sections[1].querySelector('.svg-icon')).toBeNull();
	});

	it('keeps the controls of a section in description order', () => {
		const { root } = build(chartWith([
			{ widget: 'checkbox', id: 'first', key: 'a', label: 'chive-a' },
			{ widget: 'text', id: 'second', key: 'b', label: 'chive-b' },
			{ widget: 'checkbox', id: 'third', key: 'c', label: 'chive-c' },
		]));

		expect([...root.querySelectorAll('input')].map(input => input.id)).toEqual(['first', 'second', 'third']);
	});

	it('wires each control as it builds it, without looking it up in the document', () => {
		const { get, writer } = build(chartWith([{ widget: 'checkbox', id: 'demo-toggle', key: 'shown', label: 'chive-a' }]));

		expect(document.getElementById('demo-toggle')).toBeNull();
		toggle(get('demo-toggle'));
		expect(writer.commit).toHaveBeenCalledWith({ shown: true });
	});

	it('rejects an unknown widget, naming the control', () => {
		expect(() => build(chartWith([{ widget: 'dial', id: 'demo-dial', key: 'a', label: 'chive-a' }])))
			.toThrow('Control "demo-dial" has an unknown widget "dial".');
	});
});

describe('described select', () => {
	it('offers "None" and the columns, shows the setting, and commits the chosen value', () => {
		const { get, writer } = build(chartWith([
			{ widget: 'select', id: 'demo-category', key: 'category', label: 'chive-category', columns: context => context.baseCategoricalOrAll },
		]), { category: 'team' });
		const select = get('demo-category');

		expect(optionsOf(select)).toEqual([['', 't(chive-chart-option-none)'], ['region', 'region'], ['team', 'team']]);
		expect(select.value).toBe('team');
		expect(select.previousElementSibling.textContent).toBe('t(chive-category)');

		fire(select, 'change', 'region');
		expect(writer.commit).toHaveBeenCalledWith({ category: 'region' });
		expect(writer.preview).not.toHaveBeenCalled();
	});

	it('lists an enumerated setting\'s values in the definition\'s order, labeled from a map or a function', () => {
		const allowedValues = { mode: ['b', 'a'], shape: ['round', 'square'] };
		const { get } = build(chartWith([
			{ widget: 'select', id: 'demo-mode', key: 'mode', label: 'chive-mode', optionLabels: { a: 'chive-mode-a', b: 'chive-mode-b' } },
			{ widget: 'select', id: 'demo-shape', key: 'shape', label: 'chive-shape', optionLabels: value => `chive-shape-${value}` },
		], allowedValues), { mode: 'a' });

		expect(optionsOf(get('demo-mode'))).toEqual([['b', 't(chive-mode-b)'], ['a', 't(chive-mode-a)']]);
		expect(get('demo-mode').value).toBe('a');
		expect(optionsOf(get('demo-shape'))).toEqual([['round', 't(chive-shape-round)'], ['square', 't(chive-shape-square)']]);
	});

	it.each([
		['its own options', { options: () => [{ value: 'a', label: 'A' }] }, 'Control "demo-mode" lists its own options, but the chart definition lists the values of "mode".'],
		['columns', { columns: context => context.allColumns }, 'Control "demo-mode" lists its own options, but the chart definition lists the values of "mode".'],
		['no label for a value', { optionLabels: { a: 'chive-mode-a' } }, 'Control "demo-mode" has no label for "b".'],
	])('rejects an enumerated setting\'s select with %s', (_case, fields, message) => {
		const descriptions = chartWith(
			[{ widget: 'select', id: 'demo-mode', key: 'mode', label: 'chive-mode', ...fields }],
			{ mode: ['a', 'b'] },
		);
		expect(() => build(descriptions)).toThrow(message);
	});

	it('rejects a select with no options', () => {
		expect(() => build(chartWith([{ widget: 'select', id: 'demo-empty', key: 'free', label: 'chive-free' }])))
			.toThrow('Control "demo-empty" lists no options for "free".');
	});

	it('lists fixed options from the context and translate', () => {
		const options = vi.fn((context, translateLabel) => [
			{ value: '0', label: translateLabel('chive-all') },
			{ value: String(context.numeric.length), label: 'Two' },
		]);
		const { get } = build(chartWith([{ widget: 'select', id: 'demo-limit', key: 'limit', label: 'chive-limit', options }]), { limit: 2 });

		expect(options).toHaveBeenCalledWith(CONTEXT, translate);
		expect(optionsOf(get('demo-limit'))).toEqual([['0', 't(chive-all)'], ['2', 'Two']]);
		expect(get('demo-limit').value).toBe('2');
	});

	it('stores what toValue returns, and writes the patch toPatch returns from it', () => {
		const toValue = vi.fn(value => value || null);
		const toPatch = vi.fn((value, { config }) => ({ category: value, previous: config.category }));
		const { get, writer } = build(chartWith([
			{ widget: 'select', id: 'demo-category', key: 'category', label: 'chive-category', columns: context => context.categorical, toValue },
			{ widget: 'select', id: 'demo-linked', key: 'category', label: 'chive-category', columns: context => context.categorical, toValue, toPatch },
		]), { category: 'team' });

		fire(get('demo-category'), 'change', '');
		expect(writer.commit).toHaveBeenLastCalledWith({ category: null });
		expect(toValue).toHaveBeenLastCalledWith('', { config: expect.objectContaining({ category: 'team' }), context: CONTEXT });

		fire(get('demo-linked'), 'change', 'region');
		expect(toPatch).toHaveBeenLastCalledWith('region', { config: expect.objectContaining({ category: 'team' }), context: CONTEXT });
		expect(writer.commit).toHaveBeenLastCalledWith({ category: 'region', previous: 'team' });
	});

	it('reads the config of the moment the event fires, not the one it was built from', () => {
		const { get, writer, dataset } = build(chartWith([{
			widget: 'select',
			id: 'demo-measure',
			key: 'measure',
			label: 'chive-measure',
			options: () => [{ value: 'sum', label: 'Sum' }],
			toPatch: (measure, { config }) => ({ measure, column: config.column }),
		}]), { column: 'sales' });

		// The state facade replaces the whole chart config on every write.
		dataset.chartConfig = { demo: { ...dataset.chartConfig.demo, column: 'profit' } };
		fire(get('demo-measure'), 'change', 'sum');

		expect(writer.commit).toHaveBeenCalledWith({ measure: 'sum', column: 'profit' });
	});

	it('shows value(config) in place of the setting', () => {
		const { get } = build(chartWith([{
			widget: 'select',
			id: 'demo-limit',
			key: 'limit',
			label: 'chive-limit',
			options: () => [{ value: '5', label: 'Five' }, { value: '10', label: 'Ten' }],
			value: config => config.limit || 10,
		}]), { limit: 0 });

		expect(get('demo-limit').value).toBe('10');
	});

	it('shows "None" for an unset setting, even next to columns named "null" and "undefined"', () => {
		const description = { widget: 'select', id: 'demo-category', key: 'category', label: 'chive-category', columns: context => context.categorical };
		const context = { ...CONTEXT, categorical: ['null', 'undefined'] };

		expect(build(chartWith([description]), { category: null }, context).get('demo-category').value).toBe('');
		expect(build(chartWith([description]), {}, context).get('demo-category').value).toBe('');
		expect(build(chartWith([description]), { category: 'null' }, context).get('demo-category').value).toBe('null');
	});

	it('shows the first option for an unset setting, even next to a column with no name', () => {
		const description = { widget: 'select', id: 'demo-category', key: 'category', label: 'chive-category', columns: context => context.categorical };
		const context = { ...CONTEXT, categorical: ['region', ''] };

		expect(build(chartWith([description]), { category: null }, context).get('demo-category').selectedIndex).toBe(0);
		expect(build(chartWith([description]), { category: 'region' }, context).get('demo-category').selectedIndex).toBe(1);
	});

	it('labels the values of an enumerated setting with the text optionText returns', () => {
		const optionText = vi.fn((value, translateText) => (value === 'custom' ? translateText('chive-ramp-custom') : value.toUpperCase()));
		const { get } = build(chartWith([{
			widget: 'select',
			id: 'demo-ramp',
			key: 'ramp',
			label: 'chive-ramp',
			optionText,
		}], { ramp: ['custom', 'viridis'] }));

		expect(optionsOf(get('demo-ramp'))).toEqual([['custom', 't(chive-ramp-custom)'], ['viridis', 'VIRIDIS']]);
		expect(optionText).toHaveBeenCalledWith('viridis', translate);
	});

	it('fills each option label with the parameters optionLabelParams gives for its value', () => {
		const optionLabelParams = vi.fn((value, config, translateParam) => (value === 'by-measure' ? [translateParam(`chive-measure-${config.measure}`)] : []));
		const { get } = build(chartWith([{
			widget: 'select',
			id: 'demo-sort',
			key: 'sort',
			label: 'chive-sort',
			optionLabels: { 'by-measure': 'chive-sort-measure', 'by-name': 'chive-sort-name' },
			optionLabelParams,
		}], { sort: ['by-measure', 'by-name'] }), { measure: 'sum' });

		expect(optionsOf(get('demo-sort'))).toEqual([
			['by-measure', 't(chive-sort-measure, t(chive-measure-sum))'],
			['by-name', 't(chive-sort-name)'],
		]);
		expect(optionLabelParams).toHaveBeenCalledWith('by-measure', expect.objectContaining({ measure: 'sum' }), translate);
	});

	it('hands the columns function the config the control is built from', () => {
		const columns = vi.fn((context, config) => (config.mode === 'category' ? context.categorical : context.numeric));
		const description = { widget: 'select', id: 'demo-field', key: 'field', label: 'chive-field', columns };
		const valuesOf = select => optionsOf(select).map(([value]) => value);

		expect(valuesOf(build(chartWith([description]), { mode: 'category' }).get('demo-field'))).toEqual(['', 'region', 'team']);
		expect(valuesOf(build(chartWith([description]), { mode: 'numeric' }).get('demo-field'))).toEqual(['', 'sales', 'profit']);
		expect(columns).toHaveBeenLastCalledWith(CONTEXT, expect.objectContaining({ mode: 'numeric' }));
	});
});

describe('described setting inside a block', () => {
	const band = { widget: 'checkbox', id: 'demo-band', key: 'regression.showCI', label: 'chive-band' };

	it('shows the setting, and writes the block of the moment with the setting changed', () => {
		const { get, writer, dataset } = build(chartWith([band]), { regression: { showCI: true, lineWidth: 2 } });
		expect(get('demo-band').checked).toBe(true);

		dataset.chartConfig = { demo: { ...dataset.chartConfig.demo, regression: { showCI: true, lineWidth: 3 } } };
		toggle(get('demo-band'));

		expect(writer.commit).toHaveBeenCalledWith({ regression: { showCI: false, lineWidth: 3 } });
	});

	it('writes a block of its own when the config has none', () => {
		const { get, writer } = build(chartWith([band]), { regression: null });
		expect(get('demo-band').checked).toBe(false);

		toggle(get('demo-band'));

		expect(writer.commit).toHaveBeenCalledWith({ regression: { showCI: true } });
	});

	it('lists the values the definition lists for the setting under the block', () => {
		const { get, writer } = build(chartWith([{
			widget: 'select',
			id: 'demo-mode',
			key: 'regression.mode',
			label: 'chive-mode',
			optionLabels: { overall: 'chive-overall', perCategory: 'chive-per-category' },
		}], { regression: { mode: ['overall', 'perCategory'] } }), { regression: { mode: 'perCategory', enabled: true } });

		expect(optionsOf(get('demo-mode'))).toEqual([['overall', 't(chive-overall)'], ['perCategory', 't(chive-per-category)']]);
		expect(get('demo-mode').value).toBe('perCategory');
		fire(get('demo-mode'), 'change', 'overall');
		expect(writer.commit).toHaveBeenCalledWith({ regression: { mode: 'overall', enabled: true } });
	});
});

describe('described control visibility', () => {
	it('builds a control only while shownWhen holds for the config and context', () => {
		const shownWhen = vi.fn(config => config.colorMode === 'gradient');
		const controls = [
			{ widget: 'checkbox', id: 'demo-always', key: 'a', label: 'chive-a' },
			{ widget: 'select', id: 'demo-distribution', key: 'distribution', label: 'chive-b', options: () => [{ value: 'rank', label: 'Rank' }], shownWhen },
			{ widget: 'custom', build: () => document.createElement('hr'), shownWhen },
		];

		const hidden = build(chartWith(controls), { colorMode: 'uniform' });
		expect(shownWhen).toHaveBeenCalledWith(expect.objectContaining({ colorMode: 'uniform' }), CONTEXT);
		expect([...hidden.root.querySelector('.chart-section-content').children].map(control => control.querySelector('input')?.id ?? control.tagName))
			.toEqual(['demo-always']);

		const shown = build(chartWith(controls), { colorMode: 'gradient' });
		expect(shown.get('demo-distribution')).not.toBeNull();
		expect(shown.root.querySelector('hr')).not.toBeNull();
	});
});

describe('described custom control', () => {
	const contentOf = root => [...root.querySelector('.chart-section-content').children];

	it('places what build returns, in description order: one element, several, or none', () => {
		const element = tag => document.createElement(tag);
		const { root } = build(chartWith([
			{ widget: 'custom', build: () => element('hr') },
			{ widget: 'checkbox', id: 'demo-between', key: 'a', label: 'chive-a' },
			{ widget: 'custom', build: () => [element('em'), element('strong')] },
			{ widget: 'custom', build: () => [] },
		]));

		expect(contentOf(root).map(control => control.tagName)).toEqual(['HR', 'DIV', 'EM', 'STRONG']);
	});

	it('hands build the dataset, the config then and now, the context, the writer, translate, and its disabled state', () => {
		const buildCustom = vi.fn(() => []);
		const disabledWhen = config => config.mode !== 'grouped';
		const { dataset, writer } = build(chartWith([{ widget: 'custom', build: buildCustom, disabledWhen }]), { mode: 'grouped', size: 2 });
		const scope = buildCustom.mock.calls[0][0];

		expect(scope).toEqual(expect.objectContaining({ dataset, context: CONTEXT, writer, translate, disabled: false }));
		expect(scope.config).toBe(dataset.chartConfig.demo);
		dataset.chartConfig = { demo: { ...dataset.chartConfig.demo, size: 3 } };
		expect(scope.readConfig()).toEqual(expect.objectContaining({ size: 3 }));
		expect(scope.config.size).toBe(2);

		build(chartWith([{ widget: 'custom', build: buildCustom, disabledWhen }]), { mode: 'flat' });
		expect(buildCustom.mock.calls[1][0].disabled).toBe(true);
		build(chartWith([{ widget: 'custom', build: buildCustom }]), { enabled: false });
		expect(buildCustom.mock.calls[2][0].disabled).toBe(true);
	});

	it('reaches a control built before it in the pass, and rejects one that is not', () => {
		let reached = null;
		const { get } = build(chartWith([
			{ widget: 'slider', id: 'demo-zoom', key: 'zoom', label: 'chive-zoom', min: 1, max: 4, step: 1 },
			{ widget: 'custom', build: ({ control }) => { reached = control('demo-zoom'); return []; } },
		]));
		expect(reached).toBe(get('demo-zoom').closest('.chart-controle'));

		expect(() => build(chartWith([
			{ widget: 'custom', build: ({ control }) => control('demo-zoom') },
			{ widget: 'slider', id: 'demo-zoom', key: 'zoom', label: 'chive-zoom', min: 1, max: 4, step: 1 },
		]))).toThrow('No control "demo-zoom" is built before the custom control that needs it.');
	});
});

describe('described slider', () => {
	it('shows its range and value, follows the drag in its output, and commits a number on release', () => {
		const { get, writer } = build(chartWith([
			{ widget: 'slider', id: 'demo-padding', key: 'padding', label: 'chive-padding', min: 1, max: 6, step: 1 },
		]), { padding: 2 });
		const slider = get('demo-padding');
		const output = slider.parentElement.querySelector('output');

		expect([slider.min, slider.max, slider.step, slider.value, output.textContent]).toEqual(['1', '6', '1', '2', '2']);

		fire(slider, 'input', '5');
		expect(output.textContent).toBe('5');
		expect(writer.commit).not.toHaveBeenCalled();
		expect(writer.preview).not.toHaveBeenCalled();

		fire(slider, 'change');
		expect(writer.commit).toHaveBeenCalledWith({ padding: 5 });
	});

	it('shows its setting, or value(config), as a number', () => {
		const slider = { widget: 'slider', id: 'demo-padding', key: 'padding', label: 'chive-padding', min: 1, max: 6, step: 1 };
		const outputOf = root => root.querySelector('output').textContent;

		expect(outputOf(build(chartWith([slider]), { padding: '03' }).root)).toBe('3');
		expect(outputOf(build(chartWith([{ ...slider, value: config => config.padding || '4' }]), { padding: 0 }).root)).toBe('4');
	});
});

describe('described number input', () => {
	const number = { widget: 'number', id: 'demo-step', key: 'step', label: 'chive-step', min: 0, step: 'any', fallback: 1 };

	it('shows its setting with its bounds, and commits the typed number when it changes', () => {
		const { get, writer, root } = build(chartWith([number]), { step: '2.5' });
		const input = get('demo-step');

		expect(root.querySelector('label').textContent).toBe('t(chive-step)');
		expect([input.type, input.min, input.max, input.step, input.value]).toEqual(['number', '0', '', 'any', '2.5']);

		fire(input, 'input', '7');
		expect(writer.commit).not.toHaveBeenCalled();
		expect(writer.preview).not.toHaveBeenCalled();

		fire(input, 'change', '7.25');
		expect(writer.commit).toHaveBeenCalledWith({ step: 7.25 });
	});

	it('shows the fallback for a setting that is not a finite number, and writes it for a typed value that is not a number', () => {
		for (const step of [undefined, 'bad', 'Infinity']) {
			expect(build(chartWith([number]), { step }).get('demo-step').value, String(step)).toBe('1');
		}
		expect(build(chartWith([{ ...number, value: config => config.step * 2 }]), { step: 3 }).get('demo-step').value).toBe('6');

		const { get, writer } = build(chartWith([number]), { step: 4 });
		fire(get('demo-step'), 'change', '');
		expect(writer.commit).toHaveBeenLastCalledWith({ step: 1 });
	});
});

describe('described checkbox', () => {
	it('is checked only for true, and commits its checked state', () => {
		const { get, writer } = build(chartWith([
			{ widget: 'checkbox', id: 'demo-on', key: 'on', label: 'chive-on' },
			{ widget: 'checkbox', id: 'demo-truthy', key: 'truthy', label: 'chive-truthy' },
		]), { on: true, truthy: 'yes' });

		expect(get('demo-on').checked).toBe(true);
		expect(get('demo-truthy').checked).toBe(false);
		expect(get('demo-on').nextElementSibling.textContent).toBe('t(chive-on)');

		toggle(get('demo-on'));
		expect(writer.commit).toHaveBeenCalledWith({ on: false });
	});
});

describe('described text', () => {
	it('limits its length, shows the setting, and commits it trimmed when it changes', () => {
		const { get, writer } = build(chartWith([
			{ widget: 'text', id: 'demo-title', key: 'title', label: 'chive-title' },
			{ widget: 'text', id: 'demo-short', key: 'short', label: 'chive-short', maxLength: 12 },
		]), { title: 'Sales' });
		const title = get('demo-title');

		expect([title.maxLength, title.value, get('demo-short').maxLength, get('demo-short').value]).toEqual([80, 'Sales', 12, '']);

		fire(title, 'input', '  Sales by region ');
		expect(writer.commit).not.toHaveBeenCalled();
		fire(title, 'change');
		expect(writer.commit).toHaveBeenCalledWith({ title: 'Sales by region' });
	});
});

describe('described color', () => {
	it('previews while the picker is open and commits when it closes', () => {
		const { get, writer } = build(chartWith([
			{ widget: 'color', id: 'demo-color', key: 'color', label: 'chive-color', fallback: '#5a7d99' },
		]), { color: '#4e79a7' });
		const input = get('demo-color');

		expect(input.value).toBe('#4e79a7');

		fire(input, 'input', '#123456');
		expect(writer.preview).toHaveBeenCalledWith({ color: '#123456' });
		expect(writer.commit).not.toHaveBeenCalled();

		fire(input, 'change', '#abcdef');
		expect(writer.commit).toHaveBeenCalledWith({ color: '#abcdef' });
		expect(writer.preview).toHaveBeenCalledTimes(1);
	});

	it('shows the fallback for an invalid color', () => {
		const { get } = build(chartWith([
			{ widget: 'color', id: 'demo-color', key: 'color', label: 'chive-color', fallback: '#5a7d99' },
		]), { color: 'red' });

		expect(get('demo-color').value).toBe('#5a7d99');
	});

	it('writes the toPatch patch in both the preview and the commit', () => {
		const { get, writer } = build(chartWith([{
			widget: 'color',
			id: 'demo-color',
			key: 'color',
			label: 'chive-color',
			fallback: '#5a7d99',
			toPatch: color => ({ color, colorMode: 'uniform' }),
		}]));

		fire(get('demo-color'), 'input', '#123456');
		fire(get('demo-color'), 'change');
		expect(writer.preview).toHaveBeenCalledWith({ color: '#123456', colorMode: 'uniform' });
		expect(writer.commit).toHaveBeenCalledWith({ color: '#123456', colorMode: 'uniform' });
	});
});

describe('described palette', () => {
	const presetButtons = (root, id) => [...root.querySelectorAll(`button[data-color-preset-control="${id}"]`)];
	const marked = (root, id) => presetButtons(root, id)
		.filter(button => button.style.border.startsWith('2px'))
		.map(button => button.dataset.presetName);

	it('offers one button per palette and commits the palette with the colors it copies', () => {
		const { root, writer } = build(chartWith([{
			widget: 'palette',
			id: 'demo-palette',
			key: 'colorScheme',
			label: 'chive-palette',
			colorKeys: { color: 0, gradientMaxColor: -1 },
		}]));

		expect(presetButtons(root, 'demo-palette').map(button => button.dataset.presetName)).toEqual(Object.keys(COLOR_PRESETS));
		presetButtons(root, 'demo-palette').find(button => button.dataset.presetName === 'Bold').click();

		expect(writer.commit).toHaveBeenCalledWith({
			colorScheme: 'Bold',
			color: COLOR_PRESETS.Bold[0],
			gradientMaxColor: COLOR_PRESETS.Bold.at(-1),
		});
	});

	it('writes the fallback for a position the palette does not have', () => {
		const { root, writer } = build(chartWith([{
			widget: 'palette',
			id: 'demo-palette',
			key: 'colorScheme',
			label: 'chive-palette',
			colorKeys: { color: 0, accent: 99, spare: 99 },
			fallbacks: { accent: '#123456' },
		}]));

		presetButtons(root, 'demo-palette').find(button => button.dataset.presetName === 'Pastel').click();

		expect(writer.commit).toHaveBeenCalledWith({
			colorScheme: 'Pastel',
			color: COLOR_PRESETS.Pastel[0],
			accent: '#123456',
			spare: COLOR_PRESETS.Pastel[0],
		});
	});

	it('marks the preset whose colors are still in place, or the one marked(config) names', () => {
		const copied = { colorKeys: { color: 0, gradientMaxColor: -1 } };
		const pastel = { color: COLOR_PRESETS.Pastel[0], gradientMaxColor: COLOR_PRESETS.Pastel.at(-1), colorScheme: 'Bold' };

		const byColors = build(chartWith([{ widget: 'palette', id: 'demo-palette', key: 'colorScheme', label: 'chive-palette', ...copied }]), pastel);
		expect(marked(byColors.root, 'demo-palette')).toEqual(['Pastel']);

		const byConfig = build(chartWith([{
			widget: 'palette', id: 'demo-palette', key: 'colorScheme', label: 'chive-palette', ...copied, marked: config => config.colorScheme,
		}]), pastel);
		expect(marked(byConfig.root, 'demo-palette')).toEqual(['Bold']);
	});

	it('commits nothing from a disabled button', () => {
		const { root, writer } = build(chartWith([
			{ widget: 'palette', id: 'demo-palette', key: 'colorScheme', label: 'chive-palette', colorKeys: {} },
		]), { enabled: false });

		presetButtons(root, 'demo-palette')[0].click();
		expect(writer.commit).not.toHaveBeenCalled();
	});
});

describe('described control disabled state', () => {
	const EVERY_WIDGET = [
		{ widget: 'select', id: 'demo-select', key: 'category', label: 'chive-a', columns: context => context.categorical },
		{ widget: 'slider', id: 'demo-slider', key: 'size', label: 'chive-b', min: 0, max: 10, step: 1 },
		{ widget: 'number', id: 'demo-number', key: 'step', label: 'chive-g', fallback: 1 },
		{ widget: 'checkbox', id: 'demo-checkbox', key: 'on', label: 'chive-c' },
		{ widget: 'text', id: 'demo-text', key: 'title', label: 'chive-d' },
		{ widget: 'color', id: 'demo-color', key: 'color', label: 'chive-e', fallback: '#000000' },
		{ widget: 'palette', id: 'demo-palette', key: 'colorScheme', label: 'chive-f', colorKeys: {} },
	];
	const disabledStates = root => [...root.querySelectorAll('select, input, button[data-preset-name]')]
		.map(element => element.disabled);

	it('disables every widget while the chart is off', () => {
		expect(disabledStates(build(chartWith(EVERY_WIDGET), { enabled: false }).root).every(Boolean)).toBe(true);
		expect(disabledStates(build(chartWith(EVERY_WIDGET), { enabled: true }).root).some(Boolean)).toBe(false);
	});

	it('disables a control while disabledWhen holds for the config and context', () => {
		const disabledWhen = vi.fn(config => config.colorMode !== 'uniform');
		const description = { widget: 'color', id: 'demo-color', key: 'color', label: 'chive-color', fallback: '#000000', disabledWhen };

		expect(build(chartWith([description]), { colorMode: 'scheme' }).get('demo-color').disabled).toBe(true);
		expect(disabledWhen).toHaveBeenLastCalledWith(expect.objectContaining({ colorMode: 'scheme' }), CONTEXT);
		expect(build(chartWith([description]), { colorMode: 'uniform' }).get('demo-color').disabled).toBe(false);
	});
});
