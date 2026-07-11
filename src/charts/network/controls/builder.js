/**
 * Network-graph controls: section builder.
 *
 * Builds the right-sidebar control group for the network graph (source/target
 * column bindings, weight/group accessors, D3 force-simulation parameters).
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 */

import { t } from '../../../services/i18nService.js';
import { NETWORK_GRAPH } from '../../../config/charts.js';
import { createCheckboxControl, createColorInputControl, createSliderControl, createTextControl, createColorPresetControl, createSelectControl } from '../../../modules/chartControls/shared.js';
import { groupControls } from '../../../modules/chartControls/controlGrouping.js';

/**
 * Build the network-graph control sections (Data, Display, Styling, Advanced).
 *
 * @param {Dataset} dataset
 * @param {string[]} allOptions - All visible column names; populates source/target/weight/group selects.
 * @param {string[]} numericOptions - Numeric column names; reserved for future numeric-only selects.
 * @param {string[]} categoryOptions - Categorical column names; reserved for future categorical-only selects.
 * @returns {HTMLElement[]} Array of `chart-control-section` elements.
 */
export function createNetworkGraphControls(dataset, allOptions, numericOptions, categoryOptions) {
	const config = dataset.chartConfig.network;
	const disabled = !dataset.chartConfig.network.enabled;

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

	stylingControls.push(createColorInputControl(
		'viz-input-network-source-color',
		t('chive-chart-color-source-node'),
		config.sourceNodeColor,
		'#e3743d',
		disabled,
	));

	stylingControls.push(createColorInputControl(
		'viz-input-network-target-color',
		t('chive-chart-color-target-node'),
		config.targetNodeColor,
		'#6b94c9',
		disabled,
	));

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
