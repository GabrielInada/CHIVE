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
