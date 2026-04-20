export function normalizeHexColor(value, fallback) {
	const color = String(value || '').trim();
	return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

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

export function createTextControl(id, labelText, value, maxLength = 80, disabled = false) {
	const div = document.createElement('div');
	div.className = 'chart-controle';

	const label = document.createElement('label');
	label.htmlFor = id;
	label.textContent = labelText;

	const input = document.createElement('input');
	input.id = id;
	input.type = 'text';
	input.className = 'linhas-select';
	input.value = String(value || '');
	input.maxLength = maxLength;
	input.disabled = disabled;

	div.appendChild(label);
	div.appendChild(input);
	return div;
}

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

export function createSelectControl(id, labelText, optionsArray, selectedValue, disabled = false) {
	const div = document.createElement('div');
	div.className = 'chart-controle';

	const label = document.createElement('label');
	label.htmlFor = id;
	label.textContent = labelText;

	const select = document.createElement('select');
	select.id = id;
	select.className = 'linhas-select';
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

// Color Presets for palette quick-apply
import { CHART_COLOR_PALETTES } from '../../config/charts.js';
export const COLOR_PRESETS = CHART_COLOR_PALETTES;

export { hexToRgb, rgbToHex, interpolateColor } from '../../utils/colorUtils.js';

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
		btn.textContent = name;
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
	
	div.appendChild(label);
	div.appendChild(presetButtons);
	return div;
}

export function createColorPickerGridControl(id, labelText, items, colorMap, disabled = false, onColorChange) {
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
