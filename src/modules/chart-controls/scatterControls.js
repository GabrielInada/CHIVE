import { CHART_COLORS } from '../../config/index.js';
import { t } from '../../services/i18nService.js';
import { updateActiveDatasetChartConfig } from '../stateSync.js';
import { createCheckboxControl, normalizeHexColor } from './shared.js';

function createSelectControl(id, labelKey, optionsArray, selectedValue, disabled = false) {
	const div = document.createElement('div');
	div.className = 'chart-controle';

	const label = document.createElement('label');
	label.htmlFor = id;
	label.textContent = t(labelKey);

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

export function createScatterPlotControls(dataset, numericOptions) {
	const config = dataset.configGraficos.scatter;
	const controls = [];

	const xOptions = [
		{ value: '', label: t('chive-chart-option-none') },
		...numericOptions.map(opt => ({ value: opt, label: opt })),
	];
	controls.push(createSelectControl(
		'viz-select-x',
		'chive-chart-control-scatter-x',
		xOptions,
		config.x,
		!dataset.configGraficos.scatter.enabled,
	));

	const yOptions = [
		{ value: '', label: t('chive-chart-option-none') },
		...numericOptions.map(opt => ({ value: opt, label: opt })),
	];
	controls.push(createSelectControl(
		'viz-select-y',
		'chive-chart-control-scatter-y',
		yOptions,
		config.y,
		!dataset.configGraficos.scatter.enabled,
	));

	const xScaleOptions = [
		{ value: 'linear', label: t('chive-chart-scale-linear') },
		{ value: 'log', label: t('chive-chart-scale-log') },
	];
	controls.push(createSelectControl(
		'viz-select-scatter-xscale',
		'chive-chart-control-scatter-xscale',
		xScaleOptions,
		config.xScale,
		!dataset.configGraficos.scatter.enabled,
	));

	const yScaleOptions = [
		{ value: 'linear', label: t('chive-chart-scale-linear') },
		{ value: 'log', label: t('chive-chart-scale-log') },
	];
	controls.push(createSelectControl(
		'viz-select-scatter-yscale',
		'chive-chart-control-scatter-yscale',
		yScaleOptions,
		config.yScale,
		!dataset.configGraficos.scatter.enabled,
	));

	const radiusOptions = [
		{ value: '2', label: '2' },
		{ value: '3', label: '3' },
		{ value: '4', label: '4' },
		{ value: '6', label: '6' },
	];
	controls.push(createSelectControl(
		'viz-select-scatter-radius',
		'chive-chart-control-scatter-radius',
		radiusOptions,
		config.radius,
		!dataset.configGraficos.scatter.enabled,
	));

	const opacityOptions = [
		{ value: '0.3', label: '30%' },
		{ value: '0.5', label: '50%' },
		{ value: '0.7', label: '70%' },
		{ value: '1', label: '100%' },
	];
	controls.push(createSelectControl(
		'viz-select-scatter-opacity',
		'chive-chart-control-scatter-opacity',
		opacityOptions,
		config.opacity,
		!dataset.configGraficos.scatter.enabled,
	));

	controls.push(createCheckboxControl(
		'viz-toggle-scatter-x-label',
		t('chive-chart-control-axis-label-x'),
		config.showXAxisLabel,
		!dataset.configGraficos.scatter.enabled
	));

	controls.push(createCheckboxControl(
		'viz-toggle-scatter-y-label',
		t('chive-chart-control-axis-label-y'),
		config.showYAxisLabel,
		!dataset.configGraficos.scatter.enabled
	));

	const colorDiv = document.createElement('div');
	colorDiv.className = 'chart-controle';

	const colorLabel = document.createElement('label');
	colorLabel.htmlFor = 'viz-input-scatter-color';
	colorLabel.textContent = t('chive-chart-control-scatter-color');

	const colorInput = document.createElement('input');
	colorInput.id = 'viz-input-scatter-color';
	colorInput.type = 'color';
	colorInput.className = 'chart-color-input';
	colorInput.value = normalizeHexColor(config.color, CHART_COLORS.scatter);
	colorInput.disabled = !dataset.configGraficos.scatter.enabled;

	colorDiv.appendChild(colorLabel);
	colorDiv.appendChild(colorInput);
	controls.push(colorDiv);

	return controls;
}

export function setupScatterPlotControlListeners(dataset, numericas, onConfigChanged) {
	const toggleScatter = document.getElementById('viz-toggle-scatter');
	const expandScatter = document.getElementById('viz-expand-scatter');

	if (toggleScatter) {
		toggleScatter.addEventListener('change', () => {
			const xAtual = dataset.configGraficos.scatter?.x;
			const yAtual = dataset.configGraficos.scatter?.y;
			const xPadrao = numericas.includes(xAtual) ? xAtual : (numericas[0] || null);
			const yPadrao = numericas.includes(yAtual)
				? yAtual
				: (numericas[1] || numericas[0] || null);
			updateActiveDatasetChartConfig({
				scatter: {
					...dataset.configGraficos.scatter,
					enabled: toggleScatter.checked,
					x: toggleScatter.checked ? xPadrao : xAtual,
					y: toggleScatter.checked ? yPadrao : yAtual,
					expanded: toggleScatter.checked ? true : dataset.configGraficos.scatter?.expanded === true,
				},
			});
			onConfigChanged?.();
		});
	}

	if (expandScatter) {
		expandScatter.addEventListener('click', () => {
			const expanded = expandScatter.getAttribute('aria-expanded') === 'true';
			updateActiveDatasetChartConfig({
				scatter: {
					...dataset.configGraficos.scatter,
					expanded: !expanded,
				},
			});
			onConfigChanged?.();
		});
	}

	const scatterControls = [
		{ id: 'viz-select-x', key: 'x' },
		{ id: 'viz-select-y', key: 'y' },
		{ id: 'viz-select-scatter-xscale', key: 'xScale' },
		{ id: 'viz-select-scatter-yscale', key: 'yScale' },
		{ id: 'viz-select-scatter-radius', key: 'radius', type: 'number' },
		{ id: 'viz-select-scatter-opacity', key: 'opacity', type: 'number' },
	];

	scatterControls.forEach(({ id, key, type }) => {
		const select = document.getElementById(id);
		if (select) {
			select.addEventListener('change', () => {
				const value = type === 'number' ? Number(select.value) : select.value;
				updateActiveDatasetChartConfig({
					scatter: {
						...dataset.configGraficos.scatter,
						[key]: value,
					},
				});
				onConfigChanged?.();
			});
		}
	});

	const inputScatterColor = document.getElementById('viz-input-scatter-color');
	if (inputScatterColor) {
		inputScatterColor.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				scatter: {
					...dataset.configGraficos.scatter,
					color: normalizeHexColor(inputScatterColor.value, CHART_COLORS.scatter),
				},
			});
			onConfigChanged?.();
		});
	}

	const toggleScatterXLabel = document.getElementById('viz-toggle-scatter-x-label');
	if (toggleScatterXLabel) {
		toggleScatterXLabel.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				scatter: {
					...dataset.configGraficos.scatter,
					showXAxisLabel: toggleScatterXLabel.checked,
				},
			});
			onConfigChanged?.();
		});
	}

	const toggleScatterYLabel = document.getElementById('viz-toggle-scatter-y-label');
	if (toggleScatterYLabel) {
		toggleScatterYLabel.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				scatter: {
					...dataset.configGraficos.scatter,
					showYAxisLabel: toggleScatterYLabel.checked,
				},
			});
			onConfigChanged?.();
		});
	}
}
