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
