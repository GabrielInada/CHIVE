/**
 * CHIVE chart-control element factories.
 *
 * DOM-only helpers that build the per-control widgets used by every
 * chart controls package (`charts/bar/controls/`, `charts/pie/controls/`, ...). Each
 * factory returns a `<div>` containing a label plus the input element;
 * listeners are wired separately via `controlListenerHelpers.js`.
 *
 * Also re-exports a handful of color utilities so per-chart files only
 * need to import from one place.
 */

import { normalizeHexColor } from '../../utils/colorUtils.js';

/**
 * Build a labeled checkbox control.
 *
 * @param {string} id
 * @param {string} labelText
 * @param {boolean} checked
 * @param {boolean} [disabled=false]
 * @returns {HTMLElement}
 */
export function createCheckboxControl(id, labelText, checked, disabled = false) {
	const div = document.createElement('div');
	div.className = 'chart-controle chart-controle-inline';

	const label = document.createElement('label');
	label.className = 'chart-checkbox-label';
	label.htmlFor = id;

	const input = document.createElement('input');
	input.id = id;
	input.type = 'checkbox';
	input.checked = checked === true;
	input.disabled = disabled;

	const text = document.createElement('span');
	text.textContent = labelText;

	label.appendChild(input);
	label.appendChild(text);
	div.appendChild(label);

	return div;
}

/**
 * Build a labeled text input.
 *
 * @param {string} id
 * @param {string} labelText
 * @param {string | null | undefined} value
 * @param {number} [maxLength=80]
 * @param {boolean} [disabled=false]
 * @returns {HTMLElement}
 */
export function createTextControl(id, labelText, value, maxLength = 80, disabled = false) {
	const div = document.createElement('div');
	div.className = 'chart-controle';

	const label = document.createElement('label');
	label.htmlFor = id;
	label.textContent = labelText;

	const input = document.createElement('input');
	input.id = id;
	input.type = 'text';
	input.className = 'rows-select';
	input.value = String(value || '');
	input.maxLength = maxLength;
	input.disabled = disabled;

	div.appendChild(label);
	div.appendChild(input);
	return div;
}

/**
 * Build a labeled numeric input. Any of `min`/`max`/`step` may be omitted
 * to leave the input unconstrained on that axis.
 *
 * @param {string} id
 * @param {string} labelText
 * @param {number | null | undefined} value
 * @param {{ min?: number, max?: number, step?: number, disabled?: boolean }} [options]
 * @returns {HTMLElement}
 */
export function createNumberInputControl(id, labelText, value, { min, max, step, disabled } = {}) {
	const div = document.createElement('div');
	div.className = 'chart-controle';

	const label = document.createElement('label');
	label.htmlFor = id;
	label.textContent = labelText;

	const input = document.createElement('input');
	input.id = id;
	input.type = 'number';
	input.className = 'rows-select';
	if (min !== undefined && min !== null) input.min = String(min);
	if (max !== undefined && max !== null) input.max = String(max);
	if (step !== undefined && step !== null) input.step = String(step);
	input.value = String(value ?? '');
	input.disabled = disabled === true;

	div.appendChild(label);
	div.appendChild(input);
	return div;
}

/**
 * Build a labeled range slider with a live-value `<output>` element.
 * The output mirrors the slider value; sync wiring happens in
 * `controlListenerHelpers.js#setupSliderListener`.
 *
 * @param {string} id
 * @param {string} labelText
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @param {number} step
 * @param {boolean} [disabled=false]
 * @returns {HTMLElement}
 */
export function createSliderControl(id, labelText, value, min, max, step, disabled = false) {
	const div = document.createElement('div');
	div.className = 'chart-controle';

	const label = document.createElement('label');
	label.htmlFor = id;
	label.textContent = labelText;

	const sliderRow = document.createElement('div');
	sliderRow.className = 'chart-slider-row';

	const input = document.createElement('input');
	input.id = id;
	input.type = 'range';
	input.className = 'chart-slider-input';
	input.min = String(min);
	input.max = String(max);
	input.step = String(step);
	input.value = String(value);
	input.disabled = disabled;

	const output = document.createElement('output');
	output.className = 'chart-slider-value';
	output.htmlFor = id;
	output.textContent = String(value);

	sliderRow.appendChild(input);
	sliderRow.appendChild(output);
	div.appendChild(label);
	div.appendChild(sliderRow);

	return div;
}

/**
 * Build a labeled `<select>` populated from `optionsArray`. Each entry
 * is `{ value, label }`; the entry whose `value` matches `selectedValue`
 * (string-compared) is pre-selected.
 *
 * @param {string} id
 * @param {string} labelText
 * @param {Array<{ value: *, label: string }>} optionsArray
 * @param {*} selectedValue
 * @param {boolean} [disabled=false]
 * @returns {HTMLElement}
 */
export function createSelectControl(id, labelText, optionsArray, selectedValue, disabled = false) {
	const div = document.createElement('div');
	div.className = 'chart-controle';

	const label = document.createElement('label');
	label.htmlFor = id;
	label.textContent = labelText;

	const select = document.createElement('select');
	select.id = id;
	select.className = 'rows-select';
	select.disabled = disabled;

	optionsArray.forEach(opt => {
		const option = document.createElement('option');
		option.value = opt.value;
		option.textContent = opt.label;
		option.selected = String(opt.value) === String(selectedValue);
		select.appendChild(option);
	});

	div.appendChild(label);
	div.appendChild(select);
	return div;
}

/**
 * Build a labeled color input. Value is sanitized via
 * {@link normalizeHexColor}.
 *
 * @param {string} id
 * @param {string} labelText
 * @param {*} value
 * @param {string} fallback - Hex color used when `value` is invalid.
 * @param {boolean} [disabled=false]
 * @returns {HTMLElement}
 */
export function createColorInputControl(id, labelText, value, fallback, disabled = false) {
	const div = document.createElement('div');
	div.className = 'chart-controle';

	const label = document.createElement('label');
	label.htmlFor = id;
	label.textContent = labelText;

	const input = document.createElement('input');
	input.id = id;
	input.type = 'color';
	input.className = 'chart-color-input';
	input.value = normalizeHexColor(value, fallback);
	input.disabled = disabled === true;

	div.appendChild(label);
	div.appendChild(input);
	return div;
}

// Color Presets for palette quick-apply.
import { CHART_COLOR_PALETTES } from '../../config/charts.js';
import { t } from '../../services/i18nService.js';

/**
 * Pre-built color palettes, exposed by the chartControls layer so per-
 * chart files do not need to import directly from `config/charts.js`.
 *
 * @type {Object<string, string[]>}
 */
export const COLOR_PRESETS = CHART_COLOR_PALETTES;

export { hexToRgb, rgbToHex, interpolateColor, normalizeHexColor } from '../../utils/colorUtils.js';

const PALETTE_LABEL_KEYS = {
	Tableau10: 'chive-chart-palette-tableau10',
	Bold: 'chive-chart-palette-bold',
	Pastel: 'chive-chart-palette-pastel',
	'Colorblind-Safe': 'chive-chart-palette-colorblind-safe',
};

/** @private */
function localizedPaletteName(paletteId) {
	const key = PALETTE_LABEL_KEYS[paletteId];
	if (!key) return paletteId;
	const localized = t(key);
	return localized && localized !== key ? localized : paletteId;
}

/**
 * Build a row of palette-preset buttons. Buttons share
 * `data-color-preset-control={id}` so the listener helper
 * `setupColorPresetListeners` can wire them in batch.
 *
 * @param {string} id
 * @param {string} labelText
 * @param {string} presetName - Currently-active preset; gets a highlighted border.
 * @param {boolean} [disabled=false]
 * @param {((name: string, colors: string[]) => void) | undefined} onSelect - Per-button click handler.
 * @returns {HTMLElement}
 */
export function createColorPresetControl(id, labelText, presetName, disabled = false, onSelect) {
	const div = document.createElement('div');
	div.className = 'chart-controle';

	const label = document.createElement('label');
	label.textContent = labelText;

	const presetButtons = document.createElement('div');
	presetButtons.className = 'chart-color-preset-buttons';
	presetButtons.style.display = 'flex';
	presetButtons.style.gap = '6px';
	presetButtons.style.marginTop = '4px';
	presetButtons.style.flexWrap = 'wrap';

	Object.entries(COLOR_PRESETS).forEach(([name, colors]) => {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.dataset.colorPresetControl = id;
		btn.dataset.presetName = name;
		btn.textContent = localizedPaletteName(name);
		btn.title = localizedPaletteName(name);
		btn.className = 'chart-preset-btn';
		btn.disabled = disabled;
		btn.style.padding = '4px 8px';
		btn.style.borderRadius = '3px';
		btn.style.border = presetName === name ? '2px solid #333' : '1px solid #ccc';
		btn.style.backgroundColor = '#f9f9f9';
		btn.style.cursor = disabled ? 'not-allowed' : 'pointer';
		btn.style.opacity = disabled ? '0.5' : '1';

		btn.addEventListener('click', () => {
			if (!disabled && onSelect) {
				onSelect(name, colors);
			}
		});

		presetButtons.appendChild(btn);
	});

	const helpText = document.createElement('p');
	helpText.className = 'chart-control-help';
	helpText.textContent = t('chive-chart-color-palette-help');
	helpText.style.fontSize = '11px';
	helpText.style.color = 'var(--muted)';
	helpText.style.marginTop = '6px';
	helpText.style.lineHeight = '1.4';

	div.appendChild(label);
	div.appendChild(presetButtons);
	div.appendChild(helpText);
	return div;
}

/**
 * Build a grid of per-item color pickers (e.g. one swatch per slice in a
 * pie chart). `onColorPreview` fires on every `input` event (live
 * painting); `onColorChange` fires on `change` (committed write). Both
 * are skipped when the control is disabled.
 *
 * @param {string} id
 * @param {string} labelText
 * @param {Array<string | number>} items - Per-item identifiers.
 * @param {Object<string, string>} colorMap - Current hex value per item.
 * @param {boolean} [disabled=false]
 * @param {((item: string | number, color: string) => void) | undefined} onColorChange
 * @param {((item: string | number, color: string) => void) | undefined} onColorPreview
 * @returns {HTMLElement}
 */
export function createColorPickerGridControl(id, labelText, items, colorMap, disabled = false, onColorChange, onColorPreview) {
	const div = document.createElement('div');
	div.className = 'chart-controle';

	const label = document.createElement('label');
	label.textContent = labelText;

	const grid = document.createElement('div');
	grid.id = id;
	grid.className = 'chart-color-picker-grid';
	grid.style.display = 'grid';
	grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(120px, 1fr))';
	grid.style.gap = '8px';
	grid.style.marginTop = '6px';

	items.forEach((item) => {
		const itemDiv = document.createElement('div');
		itemDiv.className = 'chart-color-picker-item';
		itemDiv.style.display = 'flex';
		itemDiv.style.alignItems = 'center';
		itemDiv.style.gap = '6px';
		itemDiv.style.padding = '4px';
		itemDiv.style.borderRadius = '3px';
		itemDiv.style.backgroundColor = '#f5f5f5';

		const colorInput = document.createElement('input');
		colorInput.type = 'color';
		colorInput.dataset.colorItem = String(item);
		colorInput.dataset.colorGridControl = id;
		colorInput.className = 'chart-color-picker-input';
		colorInput.value = normalizeHexColor(colorMap[item], '#999999');
		colorInput.disabled = disabled;
		colorInput.style.cursor = disabled ? 'not-allowed' : 'pointer';
		colorInput.style.width = '30px';
		colorInput.style.height = '28px';

		const label2 = document.createElement('span');
		label2.textContent = String(item).slice(0, 12);
		label2.style.fontSize = '12px';
		label2.style.whiteSpace = 'nowrap';
		label2.style.overflow = 'hidden';
		label2.style.textOverflow = 'ellipsis';

		colorInput.addEventListener('input', () => {
			if (!disabled && onColorPreview) {
				onColorPreview(item, colorInput.value);
			}
		});
		colorInput.addEventListener('change', () => {
			if (!disabled && onColorChange) {
				onColorChange(item, colorInput.value);
			}
		});

		itemDiv.appendChild(colorInput);
		itemDiv.appendChild(label2);
		grid.appendChild(itemDiv);
	});
	
	div.appendChild(label);
	div.appendChild(grid);
	return div;
}
