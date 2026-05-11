export function renderChartParamsDOM({
	container,
	activeChartType,
	chartTitle,
	chartDescription,
	controls,
	translate,
}) {
	container.innerHTML = '';

	if (!activeChartType) {
		const empty = document.createElement('div');
		empty.className = 'viz-params-empty';
		empty.textContent = translate('chive-chart-params-empty');
		container.appendChild(empty);
		return;
	}

	const header = document.createElement('div');
	header.className = 'viz-params-header';

	const title = document.createElement('p');
	title.className = 'secao-titulo viz-params-title';
	title.textContent = chartTitle;
	header.appendChild(title);

	if (chartDescription) {
		const desc = document.createElement('p');
		desc.className = 'viz-params-desc';
		desc.textContent = chartDescription;
		header.appendChild(desc);
	}

	container.appendChild(header);
	controls.forEach(control => container.appendChild(control));
}
