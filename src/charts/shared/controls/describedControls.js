/**
 * CHIVE described chart controls.
 *
 * Builds a chart's sidebar sections from its control descriptions
 * ({@link ChartControlDescriptions}) and wires each control to the injected
 * {@link ChartConfigWriter} as it creates the control. A description names
 * the setting, the widget, the options and when the control is shown or
 * disabled; this module owns the DOM (through the shared factories), the
 * events, and the value each widget writes. Nothing is looked up in the
 * document afterwards, so a control cannot end up without its listener.
 *
 * A setting key with a dot names a setting inside a block of the chart's
 * config, such as scatter's `regression.mode`: the control shows that setting
 * and writes the whole block with it changed.
 *
 * The widget decides how a control writes. A color input previews while the
 * picker is open (`input`), which repaints only the chart, and commits when it
 * closes (`change`); committing on `input` would rebuild the sidebar under the
 * open picker. Every other widget commits on `change`, and a slider only
 * updates its `<output>` on `input`. A slider and a number input show their
 * setting as a number.
 *
 * A control no widget covers is written by hand: a `custom` description's
 * `build` creates and wires its elements from the {@link CustomControlScope}.
 *
 * Shared leaf infrastructure: labels arrive as message keys and go through
 * the injected `translate`, never a service import.
 *
 * @typedef {import('../../../types.js').ChartControlDescriptions} ChartControlDescriptions
 * @typedef {import('../../../types.js').ControlDescription} ControlDescription
 * @typedef {import('../../../types.js').CustomControlScope} CustomControlScope
 * @typedef {import('../../../types.js').ChartControlContext} ChartControlContext
 * @typedef {import('../../../types.js').ChartConfigWriter} ChartConfigWriter
 * @typedef {import('../../../types.js').Dataset} Dataset
 * @typedef {(key: string, ...params: *[]) => string} Translate
 * @typedef {{
 *   dataset: Dataset,
 *   config: Object,
 *   readConfig: () => Object,
 *   context: ChartControlContext,
 *   writer: ChartConfigWriter,
 *   translate: Translate,
 *   allowedValues: Object<string, ReadonlyArray<*> | Object>,
 *   built: Map<string, HTMLElement>,
 * }} BuildScope - `built` holds each widget control built so far, by id.
 */

import { normalizeHexColor } from '../../../utils/colorUtils.js';
import {
	createCheckboxControl,
	createColorInputControl,
	createColorPresetControl,
	createNumberInputControl,
	createSelectControl,
	createSliderControl,
	createTextControl,
	findAppliedColorPreset,
} from './factories.js';
import { groupControls } from './grouping.js';

/**
 * Build a chart's control sections, every control already wired to `writer`.
 *
 * @param {ChartControlDescriptions} descriptions
 * @param {Object} scope
 * @param {Dataset} scope.dataset - Its config block for the chart is read when building, and again when an event fires.
 * @param {ChartControlContext} scope.context
 * @param {ChartConfigWriter} scope.writer
 * @param {Translate} scope.translate
 * @returns {HTMLElement[]} `chart-control-section` elements, in description order.
 * @throws {Error} When a description names an unknown widget, a select's options are missing, lack a label, or contradict the chart definition, or a custom control asks for a control not built before it.
 */
export function buildDescribedControls({ definition, sections }, { dataset, context, writer, translate }) {
	/** @type {BuildScope} */
	const scope = {
		dataset,
		config: dataset.chartConfig[definition.key],
		readConfig: () => dataset.chartConfig[definition.key],
		context,
		writer,
		translate,
		allowedValues: definition.allowedValues,
		built: new Map(),
	};
	return groupControls(sections.map(section => ({
		id: section.id,
		title: section.titleKey ? translate(section.titleKey) : section.title,
		controls: section.controls.flatMap(description => buildControl(description, scope)),
		expanded: section.expanded,
		icon: section.icon,
	})));
}

const WIDGETS = Object.freeze({
	select: buildSelect,
	slider: buildSlider,
	number: buildNumber,
	checkbox: buildCheckbox,
	text: buildText,
	color: buildColor,
	palette: buildPalette,
});

/**
 * @param {ControlDescription} description
 * @param {BuildScope} scope
 * @returns {HTMLElement[]} The control's elements: none while `shownWhen` hides it, and as many as a custom control builds.
 */
function buildControl(description, scope) {
	const { widget } = description;
	if (widget !== 'custom' && !Object.hasOwn(WIDGETS, widget)) {
		throw new Error(`Control "${description.id}" has an unknown widget "${widget}".`);
	}
	if (description.shownWhen && !description.shownWhen(scope.config, scope.context)) return [];
	// Every control is disabled while its chart is off.
	const disabled = !scope.config.enabled || Boolean(description.disabledWhen?.(scope.config, scope.context));
	if (widget === 'custom') return [description.build(customScope(scope, disabled))].flat();
	const element = WIDGETS[widget](description, scope, disabled);
	scope.built.set(description.id, element);
	return [element];
}

/**
 * What a custom control's `build` receives: what a chart's builder and its
 * listeners received, plus its disabled state and the controls built before
 * it in this pass.
 *
 * @param {BuildScope} scope
 * @param {boolean} disabled
 * @returns {CustomControlScope}
 */
function customScope({ dataset, config, readConfig, context, writer, translate, built }, disabled) {
	return {
		dataset,
		config,
		readConfig,
		context,
		writer,
		translate,
		disabled,
		control: id => {
			if (!built.has(id)) throw new Error(`No control "${id}" is built before the custom control that needs it.`);
			return built.get(id);
		},
	};
}

/**
 * The value a control shows: `value(config)` when the description has one,
 * otherwise the setting it writes.
 *
 * @param {ControlDescription} description
 * @param {BuildScope} scope
 * @returns {*}
 */
function shownValue(description, scope) {
	return description.value ? description.value(scope.config) : settingIn(scope.config, description.key);
}

/**
 * @param {Object} config
 * @param {string} key - A setting, or `block.setting` for one inside a block.
 * @returns {*} The setting's value; `undefined` when its block is missing.
 */
function settingIn(config, key) {
	const [block, setting] = splitKey(key);
	return setting === undefined ? config[block] : config[block]?.[setting];
}

/**
 * The patch that stores `value` in a setting. A setting inside a block writes
 * the block as it is in `config`, with the setting changed.
 *
 * @param {Object} config - The config of the moment the patch is written.
 * @param {string} key
 * @param {*} value
 * @returns {Object}
 */
function settingPatch(config, key, value) {
	const [block, setting] = splitKey(key);
	return setting === undefined ? { [block]: value } : { [block]: { ...(config[block] || {}), [setting]: value } };
}

/**
 * @param {string} key
 * @returns {[string, string | undefined]} The block and the setting inside it, or the key alone.
 */
function splitKey(key) {
	const dot = key.indexOf('.');
	return dot === -1 ? [key, undefined] : [key.slice(0, dot), key.slice(dot + 1)];
}

/**
 * Write a widget's value. `toValue` and `toPatch` read the config of the
 * moment the event fires, not the one the control was built from.
 *
 * @param {ControlDescription} description
 * @param {BuildScope} scope
 * @param {'commit' | 'preview'} method
 * @param {*} widgetValue
 */
function write(description, scope, method, widgetValue) {
	const current = { config: scope.readConfig(), context: scope.context };
	const value = description.toValue ? description.toValue(widgetValue, current) : widgetValue;
	const patch = description.toPatch ? description.toPatch(value, current) : settingPatch(current.config, description.key, value);
	scope.writer[method](patch);
}

/**
 * The values a chart definition lists for an enumerated setting, or `null`
 * when the setting is not enumerated. The definition lists a setting inside a
 * block under the block's name.
 *
 * @param {string} key - A setting, or `block.setting`.
 * @param {Object<string, ReadonlyArray<*> | Object>} allowedValues
 * @returns {ReadonlyArray<*> | null}
 */
function enumeratedValues(key, allowedValues) {
	const [block, setting] = splitKey(key);
	const listed = Object.hasOwn(allowedValues, block) ? allowedValues[block] : null;
	if (setting === undefined) return Array.isArray(listed) ? listed : null;
	return listed && !Array.isArray(listed) && Object.hasOwn(listed, setting) && Array.isArray(listed[setting]) ? listed[setting] : null;
}

/**
 * A select's options. An enumerated setting lists exactly the values its
 * definition accepts, in that order, so its description supplies only their
 * labels; `columns` offers "None" and a column list; `options` is a fixed list
 * for any other setting.
 *
 * @param {ControlDescription} description
 * @param {BuildScope} scope
 * @returns {Array<{ value: *, label: string }>}
 */
function selectOptions(description, scope) {
	const { id, key, columns, options } = description;
	const allowed = enumeratedValues(key, scope.allowedValues);
	if (allowed) {
		if (columns || options) {
			throw new Error(`Control "${id}" lists its own options, but the chart definition lists the values of "${key}".`);
		}
		return allowed.map(value => ({ value, label: optionLabel(description, value, scope) }));
	}
	if (columns) {
		return [
			{ value: '', label: scope.translate('chive-chart-option-none') },
			...columns(scope.context, scope.config).map(column => ({ value: column, label: column })),
		];
	}
	if (options) return options(scope.context, scope.translate);
	throw new Error(`Control "${id}" lists no options for "${key}".`);
}

/**
 * The label of a value the chart definition lists: the text `optionText`
 * returns, or else the value's message key translated with its parameters.
 *
 * @param {ControlDescription} description
 * @param {*} value - A value the chart definition lists.
 * @param {BuildScope} scope
 * @returns {string}
 */
function optionLabel(description, value, scope) {
	const { optionText, optionLabelParams } = description;
	if (optionText) return optionText(value, scope.translate);
	return scope.translate(
		optionLabelKey(description, value),
		...(optionLabelParams ? optionLabelParams(value, scope.config, scope.translate) : []),
	);
}

/**
 * @param {ControlDescription} description
 * @param {*} value - A value the chart definition lists.
 * @returns {string} The value's message key.
 */
function optionLabelKey({ id, optionLabels }, value) {
	const key = typeof optionLabels === 'function'
		? optionLabels(value)
		: (optionLabels && Object.hasOwn(optionLabels, value) ? optionLabels[value] : undefined);
	if (typeof key !== 'string') throw new Error(`Control "${id}" has no label for "${value}".`);
	return key;
}

/** @type {(description: ControlDescription, scope: BuildScope, disabled: boolean) => HTMLElement} */
function buildSelect(description, scope, disabled) {
	const shown = shownValue(description, scope);
	const element = createSelectControl(
		description.id,
		scope.translate(description.label),
		selectOptions(description, scope),
		shown,
		disabled,
	);
	const select = element.querySelector('select');
	// An unset setting shows the first option, "None" in a column select. The
	// factory compares values as strings, so it would pick a column named
	// "null" or "undefined".
	if (shown === null || shown === undefined) select.selectedIndex = 0;
	select.addEventListener('change', () => write(description, scope, 'commit', select.value));
	return element;
}

/** @type {(description: ControlDescription, scope: BuildScope, disabled: boolean) => HTMLElement} */
function buildSlider(description, scope, disabled) {
	const { id, label, min, max, step } = description;
	const element = createSliderControl(id, scope.translate(label), Number(shownValue(description, scope)), min, max, step, disabled);
	const input = element.querySelector('input');
	const output = element.querySelector('output');
	input.addEventListener('input', () => {
		output.textContent = input.value;
	});
	input.addEventListener('change', () => write(description, scope, 'commit', Number(input.value)));
	return element;
}

/**
 * A number input. It shows `fallback` while the setting is not a finite
 * number, and writes `fallback` in place of a typed value that is not one.
 *
 * @type {(description: ControlDescription, scope: BuildScope, disabled: boolean) => HTMLElement}
 */
function buildNumber(description, scope, disabled) {
	const { id, label, min, max, step, fallback } = description;
	const shown = Number(shownValue(description, scope));
	const element = createNumberInputControl(
		id,
		scope.translate(label),
		Number.isFinite(shown) ? shown : fallback,
		{ min, max, step, disabled },
	);
	const input = element.querySelector('input');
	input.addEventListener('change', () => {
		const typed = parseFloat(input.value);
		write(description, scope, 'commit', Number.isFinite(typed) ? typed : fallback);
	});
	return element;
}

/** @type {(description: ControlDescription, scope: BuildScope, disabled: boolean) => HTMLElement} */
function buildCheckbox(description, scope, disabled) {
	const element = createCheckboxControl(description.id, scope.translate(description.label), shownValue(description, scope), disabled);
	const input = element.querySelector('input');
	input.addEventListener('change', () => write(description, scope, 'commit', input.checked));
	return element;
}

/** @type {(description: ControlDescription, scope: BuildScope, disabled: boolean) => HTMLElement} */
function buildText(description, scope, disabled) {
	const element = createTextControl(
		description.id,
		scope.translate(description.label),
		shownValue(description, scope),
		description.maxLength ?? 80,
		disabled,
	);
	const input = element.querySelector('input');
	input.addEventListener('change', () => write(description, scope, 'commit', String(input.value || '').trim()));
	return element;
}

/** @type {(description: ControlDescription, scope: BuildScope, disabled: boolean) => HTMLElement} */
function buildColor(description, scope, disabled) {
	const { id, label, fallback } = description;
	const element = createColorInputControl(id, scope.translate(label), shownValue(description, scope), fallback, disabled);
	const input = element.querySelector('input');
	input.addEventListener('input', () => write(description, scope, 'preview', normalizeHexColor(input.value, fallback)));
	input.addEventListener('change', () => write(description, scope, 'commit', normalizeHexColor(input.value, fallback)));
	return element;
}

/**
 * Palette buttons. A click commits the preset's name to the setting and copies
 * its colors into `colorKeys`: each key takes the palette position it maps to,
 * negative positions counting from the end.
 *
 * @type {(description: ControlDescription, scope: BuildScope, disabled: boolean) => HTMLElement}
 */
function buildPalette(description, scope, disabled) {
	const { id, key, label, colorKeys = {}, fallbacks = {} } = description;
	const marked = description.marked
		? description.marked(scope.config)
		: findAppliedColorPreset(scope.config, colorKeys);
	return createColorPresetControl(id, scope.translate(label), marked, disabled, scope.translate, (name, colors) => {
		const patch = { [key]: name };
		Object.entries(colorKeys).forEach(([colorKey, position]) => {
			const index = position < 0 ? colors.length + position : position;
			patch[colorKey] = normalizeHexColor(colors[index], fallbacks[colorKey] || colors[0]);
		});
		scope.writer.commit(patch);
	});
}
