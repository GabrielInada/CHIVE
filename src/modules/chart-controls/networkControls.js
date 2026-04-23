import { t } from '../../services/i18nService.js';
import { updateActiveDatasetChartConfig } from '../stateSync.js';
import { NETWORK_GRAPH } from '../../config/charts.js';
import { createCheckboxControl, createSliderControl, createTextControl, normalizeHexColor, createColorPresetControl, COLOR_PRESETS, createSelectControl } from './shared.js';
import { groupControls } from './controlGrouping.js';
import {
	setupExpandListener,
	setupSelectListeners,
	setupCheckboxListeners,
	setupTextInputListener,
	setupColorInputListener,
	setupSliderListeners,
	setupColorPresetListeners,
} from './controlListenerHelpers.js';

export function createNetworkGraphControls(dataset, allOptions, numericOptions, categoryOptions) {
	const config = dataset.configGraficos.network;
	const disabled = !dataset.configGraficos.network.enabled;

	// ====== DATA & AGGREGATION SECTION (Node/edge definitions) ======
	const dataControls = [];

	const baseOptions = [
		{ value: '', label: t('chive-chart-option-none') },
		...allOptions.map(opt => ({ value: opt, label: opt })),
	];

	dataControls.push(createSelectControl(
		'viz-select-network-source',
		t('chive-chart-control-network-source'),
		baseOptions,
		config.source,
		disabled
	));

	dataControls.push(createSelectControl(
		'viz-select-network-target',
		t('chive-chart-control-network-target'),
		baseOptions,
		config.target,
		disabled
	));

	dataControls.push(createSelectControl(
		'viz-select-network-weight',
		t('chive-chart-control-network-weight'),
		[
			{ value: '', label: t('chive-chart-option-none') },
			...numericOptions.map(opt => ({ value: opt, label: opt })),
		],
		config.weight,
		disabled
	));

	dataControls.push(createSelectControl(
		'viz-select-network-group',
		t('chive-chart-control-network-group'),
		[
			{ value: '', label: t('chive-chart-option-none') },
			...categoryOptions.map(opt => ({ value: opt, label: opt })),
		],
		config.group,
		disabled
	));

	// ====== DISPLAY SECTION ======
	const displayControls = [];

	displayControls.push(createSliderControl(
		'viz-slider-network-link-distance',
		t('chive-chart-control-network-link-distance'),
		Number(config.linkDistance),
		20,
		140,
		1,
		disabled
	));

	displayControls.push(createSliderControl(
		'viz-slider-network-zoom',
		t('chive-chart-control-network-zoom'),
		Number(config.zoomScale),
		NETWORK_GRAPH.minZoomScale,
		NETWORK_GRAPH.maxZoomScale,
		0.05,
		disabled
	));

	displayControls.push(createCheckboxControl(
		'viz-toggle-network-show-legend',
		t('chive-chart-control-network-show-legend'),
		config.showLegend,
		disabled
	));

	displayControls.push(createTextControl(
		'viz-input-network-title',
		t('chive-chart-control-common-title'),
		config.customTitle,
		80,
		disabled
	));

	displayControls.push(createSliderControl(
		'viz-slider-network-height',
		t('chive-chart-control-common-height'),
		Number(config.chartHeight || 420),
		220,
		720,
		10,
		disabled
	));

	displayControls.push(createCheckboxControl(
		'viz-toggle-network-node-labels',
		t('chive-chart-control-network-node-labels'),
		config.showNodeLabels,
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
	displayControls.push(resetZoomDiv);

	// ====== STYLING SECTION ======
	const stylingControls = [];

	stylingControls.push(createSliderControl(
		'viz-slider-network-node-radius',
		t('chive-chart-control-network-node-radius'),
		Number(config.nodeRadius),
		3,
		12,
		1,
		disabled
	));

	stylingControls.push(createSliderControl(
		'viz-slider-network-link-opacity',
		t('chive-chart-control-network-link-opacity'),
		Number(config.linkOpacity),
		0.1,
		1,
		0.05,
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
	stylingControls.push(sourceColorDiv);

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
	stylingControls.push(targetColorDiv);

	stylingControls.push(createSelectControl(
		'viz-select-network-edge-color-mode',
		t('chive-chart-color-mode'),
		[
			{ value: 'gradient', label: t('chive-chart-color-gradient') },
			{ value: 'uniform', label: t('chive-chart-color-uniform') },
		],
		config.edgeColorMode,
		disabled
	));

	stylingControls.push(createColorPresetControl(
		'viz-network-color-preset',
		t('chive-chart-color-palette'),
		config.colorScheme || 'Bold',
		disabled
	));

	// ====== ADVANCED SECTION (Force simulation physics) ======
	const advancedControls = [];

	advancedControls.push(createSliderControl(
		'viz-slider-network-charge',
		t('chive-chart-control-network-charge'),
		Number(config.chargeStrength),
		-300,
		-20,
		10,
		disabled
	));

	advancedControls.push(createSliderControl(
		'viz-slider-network-alpha-decay',
		t('chive-chart-control-network-alpha-decay'),
		Number(config.alphaDecay),
		0.01,
		0.2,
		0.01,
		disabled
	));

	// ====== Group and return all sections ======
	return groupControls([
		{ id: 'data', title: 'Data & Aggregation', controls: dataControls, expanded: true, icon: 'data' },
		{ id: 'display', title: 'Display', controls: displayControls, expanded: true, icon: 'display' },
		{ id: 'styling', title: 'Styling', controls: stylingControls, expanded: false, icon: 'styling' },
		{ id: 'advanced', title: 'Advanced', controls: advancedControls, expanded: false, icon: 'advanced' },
	]);
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

	setupExpandListener('viz-expand-network', dataset, 'network', onConfigChanged);

	setupSelectListeners([
		{ id: 'viz-select-network-source', key: 'source' },
		{ id: 'viz-select-network-target', key: 'target' },
		{ id: 'viz-select-network-weight', key: 'weight', transform: v => v || null },
		{ id: 'viz-select-network-group', key: 'group', transform: v => v || null },
		{ id: 'viz-select-network-edge-color-mode', key: 'edgeColorMode', transform: v => v === 'uniform' ? 'uniform' : 'gradient' },
	], dataset, 'network', onConfigChanged);

	setupSliderListeners([
		{ id: 'viz-slider-network-node-radius', key: 'nodeRadius' },
		{ id: 'viz-slider-network-link-distance', key: 'linkDistance' },
		{ id: 'viz-slider-network-charge', key: 'chargeStrength' },
		{ id: 'viz-slider-network-link-opacity', key: 'linkOpacity' },
		{ id: 'viz-slider-network-zoom', key: 'zoomScale' },
		{ id: 'viz-slider-network-alpha-decay', key: 'alphaDecay' },
		{ id: 'viz-slider-network-height', key: 'chartHeight' },
	], dataset, 'network', onConfigChanged);

	// Reset zoom button (custom: resets slider DOM + config)
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

	setupCheckboxListeners([
		{ id: 'viz-toggle-network-node-labels', key: 'showNodeLabels' },
		{ id: 'viz-toggle-network-show-legend', key: 'showLegend' },
	], dataset, 'network', onConfigChanged);

	setupColorInputListener('viz-input-network-source-color', 'sourceNodeColor', '#e3743d', dataset, 'network', onConfigChanged);
	setupColorInputListener('viz-input-network-target-color', 'targetNodeColor', '#6b94c9', dataset, 'network', onConfigChanged);

	setupColorPresetListeners('viz-network-color-preset', {
		sourceNodeColor: 0, targetNodeColor: 1,
	}, {
		sourceNodeColor: '#e3743d', targetNodeColor: '#6b94c9',
	}, dataset, 'network', onConfigChanged, COLOR_PRESETS);

	setupTextInputListener('viz-input-network-title', 'customTitle', dataset, 'network', onConfigChanged);
}
