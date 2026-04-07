import { t } from '../../services/i18nService.js';
import { updateActiveDatasetChartConfig } from '../stateSync.js';
import { NETWORK_GRAPH } from '../../config/charts.js';
import { createCheckboxControl, createSliderControl, createTextControl, normalizeHexColor, createColorPresetControl, COLOR_PRESETS } from './shared.js';
import { createChartFilterControls, setupChartFilterControlListeners } from './filterControls.js';

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
		NETWORK_GRAPH.minZoomScale,
		NETWORK_GRAPH.maxZoomScale,
		0.05,
		disabled
	));

	const resetZoomDiv = document.createElement('div');
	resetZoomDiv.className = 'chart-controle';
	const resetZoomBtn = document.createElement('button');
	resetZoomBtn.type = 'button';
	resetZoomBtn.id = 'viz-btn-network-reset-zoom';
	resetZoomBtn.className = 'chart-control-btn';
	resetZoomBtn.textContent = t('chive-chart-control-network-reset-zoom');
	resetZoomBtn.disabled = disabled;
	resetZoomDiv.appendChild(resetZoomBtn);
	controls.push(resetZoomDiv);

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

	const sourceColorDiv = document.createElement('div');
	sourceColorDiv.className = 'chart-controle';
	const sourceColorLabel = document.createElement('label');
	sourceColorLabel.htmlFor = 'viz-input-network-source-color';
	sourceColorLabel.textContent = t('chive-chart-color-source-node');
	const sourceColorInput = document.createElement('input');
	sourceColorInput.id = 'viz-input-network-source-color';
	sourceColorInput.type = 'color';
	sourceColorInput.className = 'chart-color-input';
	sourceColorInput.value = normalizeHexColor(config.sourceNodeColor, '#e3743d');
	sourceColorInput.disabled = disabled;
	sourceColorDiv.appendChild(sourceColorLabel);
	sourceColorDiv.appendChild(sourceColorInput);
	controls.push(sourceColorDiv);

	const targetColorDiv = document.createElement('div');
	targetColorDiv.className = 'chart-controle';
	const targetColorLabel = document.createElement('label');
	targetColorLabel.htmlFor = 'viz-input-network-target-color';
	targetColorLabel.textContent = t('chive-chart-color-target-node');
	const targetColorInput = document.createElement('input');
	targetColorInput.id = 'viz-input-network-target-color';
	targetColorInput.type = 'color';
	targetColorInput.className = 'chart-color-input';
	targetColorInput.value = normalizeHexColor(config.targetNodeColor, '#6b94c9');
	targetColorInput.disabled = disabled;
	targetColorDiv.appendChild(targetColorLabel);
	targetColorDiv.appendChild(targetColorInput);
	controls.push(targetColorDiv);

	controls.push(createSelectControl(
		'viz-select-network-edge-color-mode',
		t('chive-chart-color-mode'),
		[
			{ value: 'gradient', label: t('chive-chart-color-gradient') },
			{ value: 'uniform', label: t('chive-chart-color-uniform') },
		],
		config.edgeColorMode,
		disabled
	));

	controls.push(createColorPresetControl(
		'viz-network-color-preset',
		t('chive-chart-color-palette'),
		config.colorScheme || 'Bold',
		disabled
	));

	controls.push(createTextControl(
		'viz-input-network-title',
		t('chive-chart-control-common-title'),
		config.customTitle,
		80,
		disabled
	));

	controls.push(createSliderControl(
		'viz-slider-network-height',
		t('chive-chart-control-common-height'),
		Number(config.chartHeight || 420),
		220,
		720,
		10,
		disabled
	));

	controls.push(createCheckboxControl(
		'viz-toggle-network-node-labels',
		t('chive-chart-control-network-node-labels'),
		config.showNodeLabels,
		disabled
	));

	controls.push(...createChartFilterControls({
		chartKey: 'network',
		rows: dataset.dados,
		allColumns: allOptions,
		numericColumns: numericOptions,
		rawFilter: config.filter,
		disabled,
	}));

	return controls;
}

export function setupNetworkGraphControlListeners(dataset, allOptions, numericOptionsOrCallback = [], onConfigChangedMaybe) {
	const numericOptions = Array.isArray(numericOptionsOrCallback) ? numericOptionsOrCallback : [];
	const onConfigChanged = typeof numericOptionsOrCallback === 'function'
		? numericOptionsOrCallback
		: onConfigChangedMaybe;
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

	const networkZoomSlider = document.getElementById('viz-slider-network-zoom');
	const resetNetworkZoomButton = document.getElementById('viz-btn-network-reset-zoom');
	if (resetNetworkZoomButton) {
		resetNetworkZoomButton.addEventListener('click', () => {
			if (networkZoomSlider) {
				networkZoomSlider.value = String(NETWORK_GRAPH.defaultZoomScale);
				const output = networkZoomSlider.parentElement?.querySelector('output');
				if (output) output.textContent = networkZoomSlider.value;
			}
			updateActiveDatasetChartConfig({
				network: {
					...dataset.configGraficos.network,
					zoomScale: NETWORK_GRAPH.defaultZoomScale,
				},
			});
			onConfigChanged?.();
		});
	}

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

	const sourceColorInput = document.getElementById('viz-input-network-source-color');
	if (sourceColorInput) {
		sourceColorInput.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				network: {
					...dataset.configGraficos.network,
					sourceNodeColor: normalizeHexColor(sourceColorInput.value, '#e3743d'),
				},
			});
			onConfigChanged?.();
		});
	}

	const targetColorInput = document.getElementById('viz-input-network-target-color');
	if (targetColorInput) {
		targetColorInput.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				network: {
					...dataset.configGraficos.network,
					targetNodeColor: normalizeHexColor(targetColorInput.value, '#6b94c9'),
				},
			});
			onConfigChanged?.();
		});
	}

	const edgeColorModeSelect = document.getElementById('viz-select-network-edge-color-mode');
	if (edgeColorModeSelect) {
		edgeColorModeSelect.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				network: {
					...dataset.configGraficos.network,
					edgeColorMode: edgeColorModeSelect.value === 'uniform' ? 'uniform' : 'gradient',
				},
			});
			onConfigChanged?.();
		});
	}

	const networkPresetButtons = document.querySelectorAll('button[data-color-preset-control="viz-network-color-preset"]');
	networkPresetButtons.forEach(button => {
		button.addEventListener('click', () => {
			const presetName = button.dataset.presetName;
			const palette = COLOR_PRESETS[presetName] || [];
			if (palette.length < 2) return;
			updateActiveDatasetChartConfig({
				network: {
					...dataset.configGraficos.network,
					colorScheme: presetName,
					sourceNodeColor: normalizeHexColor(palette[0], '#e3743d'),
					targetNodeColor: normalizeHexColor(palette[1], '#6b94c9'),
				},
			});
			onConfigChanged?.();
		});
	});

	const inputNetworkTitle = document.getElementById('viz-input-network-title');
	if (inputNetworkTitle) {
		inputNetworkTitle.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				network: {
					...dataset.configGraficos.network,
					customTitle: String(inputNetworkTitle.value || '').trim(),
				},
			});
			onConfigChanged?.();
		});
	}

	const sliderNetworkHeight = document.getElementById('viz-slider-network-height');
	if (sliderNetworkHeight) {
		const syncOutput = () => {
			const output = sliderNetworkHeight.parentElement?.querySelector('output');
			if (output) output.textContent = sliderNetworkHeight.value;
		};
		sliderNetworkHeight.addEventListener('input', syncOutput);
		sliderNetworkHeight.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				network: {
					...dataset.configGraficos.network,
					chartHeight: Number(sliderNetworkHeight.value),
				},
			});
			onConfigChanged?.();
		});
	}

	setupChartFilterControlListeners({
		chartKey: 'network',
		rows: dataset.dados,
		numericColumns: numericOptions,
		rawFilter: dataset.configGraficos.network?.filter,
		onFilterChange: nextFilter => {
			updateActiveDatasetChartConfig({
				network: {
					...dataset.configGraficos.network,
					filter: nextFilter,
				},
			});
			onConfigChanged?.();
		},
	});
}
