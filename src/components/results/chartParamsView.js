import { PREVIEW_SVGS } from '../../modules/chart-controls/chartTypes.js';

function buildTriggerButton({ activeChartType, chartTitle, translate, onClick }) {
	const trigger = document.createElement('button');
	trigger.type = 'button';
	trigger.className = 'viz-chart-picker-trigger';
	trigger.id = 'viz-chart-picker-trigger';

	const preview = document.createElement('span');
	preview.className = 'viz-chart-picker-trigger-preview';
	if (activeChartType && PREVIEW_SVGS[activeChartType]) {
		// innerHTML: static SVG markup from PREVIEW_SVGS; not user input.
		preview.innerHTML = PREVIEW_SVGS[activeChartType];
	}
	trigger.appendChild(preview);

	const label = document.createElement('span');
	label.className = 'viz-chart-picker-trigger-label';
	if (activeChartType) {
		label.textContent = chartTitle;
	} else {
		label.classList.add('placeholder');
		label.textContent = translate('chive-chart-picker-trigger-placeholder');
	}
	trigger.appendChild(label);

	const caret = document.createElement('span');
	caret.className = 'viz-chart-picker-trigger-caret';
	caret.textContent = '▾';
	trigger.appendChild(caret);

	if (typeof onClick === 'function') {
		trigger.addEventListener('click', onClick);
	}

	return trigger;
}

export function renderChartParamsDOM({
	container,
	activeChartType,
	chartTitle,
	chartDescription,
	controls,
	translate,
	onChartTypeTriggerClick,
}) {
	container.replaceChildren();

	container.appendChild(buildTriggerButton({
		activeChartType,
		chartTitle,
		translate,
		onClick: onChartTypeTriggerClick,
	}));

	if (!activeChartType) {
		const empty = document.createElement('div');
		empty.className = 'viz-params-empty';
		empty.textContent = translate('chive-chart-params-empty');
		container.appendChild(empty);
		return;
	}

	if (chartDescription) {
		const desc = document.createElement('p');
		desc.className = 'viz-params-desc';
		desc.textContent = chartDescription;
		container.appendChild(desc);
	}

	controls.forEach(control => container.appendChild(control));
}
