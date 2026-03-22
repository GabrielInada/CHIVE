import { t } from '../../services/i18nService.js';
import { updateActiveDatasetChartConfig } from '../stateSync.js';
import { createCheckboxControl } from './shared.js';

function createSelectControl(id, labelText, optionsArray, selectedValue, disabled = false) {
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

function createSliderControl(id, labelText, value, min, max, step, disabled = false) {
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

export function createNetworkGraphControls(dataset, allOptions, numericOptions, categoryOptions) {
	const config = dataset.configGraficos.network;
	const controls = [];
	const disabled = !dataset.configGraficos.network.enabled;

	const baseOptions = [
		{ value: '', label: t('chive-chart-option-none') },
		...allOptions.map(opt => ({ value: opt, label: opt })),
	];

	controls.push(createSelectControl(
		'viz-select-network-source',
		t('chive-chart-control-network-source'),
		baseOptions,
		config.source,
		disabled
	));

	controls.push(createSelectControl(
		'viz-select-network-target',
		t('chive-chart-control-network-target'),
		baseOptions,
		config.target,
		disabled
	));

	controls.push(createSelectControl(
		'viz-select-network-weight',
		t('chive-chart-control-network-weight'),
		[
			{ value: '', label: t('chive-chart-option-none') },
			...numericOptions.map(opt => ({ value: opt, label: opt })),
		],
		config.weight,
		disabled
	));

	controls.push(createSelectControl(
		'viz-select-network-group',
		t('chive-chart-control-network-group'),
		[
			{ value: '', label: t('chive-chart-option-none') },
			...categoryOptions.map(opt => ({ value: opt, label: opt })),
		],
		config.group,
		disabled
	));

	controls.push(createSliderControl(
		'viz-slider-network-node-radius',
		t('chive-chart-control-network-node-radius'),
		Number(config.nodeRadius),
		3,
		12,
		1,
		disabled
	));

	controls.push(createSliderControl(
		'viz-slider-network-link-distance',
		t('chive-chart-control-network-link-distance'),
		Number(config.linkDistance),
		20,
		140,
		1,
		disabled
	));

	controls.push(createSliderControl(
		'viz-slider-network-charge',
		t('chive-chart-control-network-charge'),
		Number(config.chargeStrength),
		-300,
		-20,
		10,
		disabled
	));

	controls.push(createSliderControl(
		'viz-slider-network-link-opacity',
		t('chive-chart-control-network-link-opacity'),
		Number(config.linkOpacity),
		0.1,
		1,
		0.05,
		disabled
	));

	controls.push(createSliderControl(
		'viz-slider-network-zoom',
		t('chive-chart-control-network-zoom'),
		Number(config.zoomScale),
		0.3,
		4,
		0.05,
		disabled
	));

	controls.push(createSliderControl(
		'viz-slider-network-alpha-decay',
		t('chive-chart-control-network-alpha-decay'),
		Number(config.alphaDecay),
		0.01,
		0.2,
		0.01,
		disabled
	));

	controls.push(createCheckboxControl(
		'viz-toggle-network-show-legend',
		t('chive-chart-control-network-show-legend'),
		config.showLegend,
		disabled
	));

	controls.push(createCheckboxControl(
		'viz-toggle-network-node-labels',
		t('chive-chart-control-network-node-labels'),
		config.showNodeLabels,
		disabled
	));

	return controls;
}

export function setupNetworkGraphControlListeners(dataset, allOptions, onConfigChanged) {
	const toggle = document.getElementById('viz-toggle-network');
	const expand = document.getElementById('viz-expand-network');

	if (toggle) {
		toggle.addEventListener('change', () => {
			const sourceAtual = dataset.configGraficos.network?.source;
			const targetAtual = dataset.configGraficos.network?.target;
			const sourcePadrao = allOptions.includes(sourceAtual) ? sourceAtual : (allOptions[0] || null);
			const targetPadrao = allOptions.includes(targetAtual)
				? targetAtual
				: (allOptions[1] || allOptions[0] || null);
			updateActiveDatasetChartConfig({
				network: {
					...dataset.configGraficos.network,
					enabled: toggle.checked,
					source: toggle.checked ? sourcePadrao : sourceAtual,
					target: toggle.checked ? targetPadrao : targetAtual,
					expanded: toggle.checked ? true : dataset.configGraficos.network?.expanded === true,
				},
			});
			onConfigChanged?.();
		});
	}

	if (expand) {
		expand.addEventListener('click', () => {
			const expanded = expand.getAttribute('aria-expanded') === 'true';
			updateActiveDatasetChartConfig({
				network: {
					...dataset.configGraficos.network,
					expanded: !expanded,
				},
			});
			onConfigChanged?.();
		});
	}

	const selectControls = [
		{ id: 'viz-select-network-source', key: 'source' },
		{ id: 'viz-select-network-target', key: 'target' },
		{ id: 'viz-select-network-weight', key: 'weight', toNull: true },
		{ id: 'viz-select-network-group', key: 'group', toNull: true },
	];

	selectControls.forEach(({ id, key, toNull }) => {
		const select = document.getElementById(id);
		if (!select) return;
		select.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				network: {
					...dataset.configGraficos.network,
					[key]: toNull ? (select.value || null) : select.value,
				},
			});
			onConfigChanged?.();
		});
	});

	const sliderControls = [
		{ id: 'viz-slider-network-node-radius', key: 'nodeRadius' },
		{ id: 'viz-slider-network-link-distance', key: 'linkDistance' },
		{ id: 'viz-slider-network-charge', key: 'chargeStrength' },
		{ id: 'viz-slider-network-link-opacity', key: 'linkOpacity' },
		{ id: 'viz-slider-network-zoom', key: 'zoomScale' },
		{ id: 'viz-slider-network-alpha-decay', key: 'alphaDecay' },
	];

	sliderControls.forEach(({ id, key }) => {
		const slider = document.getElementById(id);
		if (!slider) return;
		const syncOutput = () => {
			const output = slider.parentElement?.querySelector('output');
			if (output) output.textContent = slider.value;
		};
		slider.addEventListener('input', syncOutput);
		slider.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				network: {
					...dataset.configGraficos.network,
					[key]: Number(slider.value),
				},
			});
			onConfigChanged?.();
		});
	});

	const nodeLabelsToggle = document.getElementById('viz-toggle-network-node-labels');
	if (nodeLabelsToggle) {
		nodeLabelsToggle.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				network: {
					...dataset.configGraficos.network,
					showNodeLabels: nodeLabelsToggle.checked,
				},
			});
			onConfigChanged?.();
		});
	}

	const legendToggle = document.getElementById('viz-toggle-network-show-legend');
	if (legendToggle) {
		legendToggle.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				network: {
					...dataset.configGraficos.network,
					showLegend: legendToggle.checked,
				},
			});
			onConfigChanged?.();
		});
	}
}
