/**
 * CHIVE Chart Controls Manager
 * 
 * Handles visualization controls in the sidebar:
 * - Chart toggle checkboxes
 * - Configuration selects (category, sort, scale, etc.)
 * - Chart expand/collapse buttons
 * - Event listeners for control changes
 */

import { t } from '../services/i18nService.js';
import {
	filterVisibleColumns,
	getNumericColumnNames,
	getCategoricalColumnNames,
} from '../utils/columnHelpers.js';
import { onStateChange } from './appState.js';
import { updateActiveDatasetChartConfig } from './stateSync.js';

// Callback when chart config changes (will be set by main.js)
let onChartConfigChangeCallback = null;

// Preview SVG constants
const PREVIEW_BAR_SVG = `
	<svg viewBox="0 0 84 38" aria-hidden="true">
		<rect x="6" y="18" width="10" height="14" rx="2"></rect>
		<rect x="22" y="10" width="10" height="22" rx="2"></rect>
		<rect x="38" y="14" width="10" height="18" rx="2"></rect>
		<rect x="54" y="6" width="10" height="26" rx="2"></rect>
		<rect x="70" y="21" width="8" height="11" rx="2"></rect>
	</svg>
`;

const PREVIEW_SCATTER_SVG = `
	<svg viewBox="0 0 84 38" aria-hidden="true">
		<circle cx="12" cy="28" r="2.6"></circle>
		<circle cx="22" cy="24" r="2.6"></circle>
		<circle cx="30" cy="19" r="2.6"></circle>
		<circle cx="40" cy="16" r="2.6"></circle>
		<circle cx="50" cy="13" r="2.6"></circle>
		<circle cx="61" cy="10" r="2.6"></circle>
		<circle cx="70" cy="7" r="2.6"></circle>
	</svg>
`;

/**
 * Initialize chart controls manager
 * @param {Function} configChangeCallback - Called when config changes
 */
export function initChartControls(configChangeCallback = null) {
	onChartConfigChangeCallback = configChangeCallback;
	
	// Re-render when expanded state changes
	onStateChange('chartExpandedChanged', handleChartExpandedChange);
}

/**
 * Handle chart expanded state change
 * @private
 */
function handleChartExpandedChange() {
	// State changed, re-render if needed
	// Main.js will call renderChartControlsSidebar on full refresh
}

/**
 * Render chart controls sidebar
 * @param {Object} dataset - Active dataset
 */
export function renderChartControlsSidebar(dataset) {
	const container = document.getElementById('lista-visualizacoes-conteudo');
	if (!container) return;

	if (!dataset) {
		container.innerHTML = '';
		const emptyDiv = document.createElement('div');
		emptyDiv.className = 'tabela-sem-colunas';
		emptyDiv.textContent = t('chive-chart-sidebar-empty');
		container.appendChild(emptyDiv);
		return;
	}

	const colunasVisiveis = filterVisibleColumns(dataset);
	const numericas = getNumericColumnNames(colunasVisiveis);
	const categoricas = getCategoricalColumnNames(colunasVisiveis);
	const baseBar = categoricas.length > 0
		? categoricas
		: colunasVisiveis.map(coluna => coluna.nome);

	if (colunasVisiveis.length === 0) {
		container.innerHTML = '';
		const emptyDiv = document.createElement('div');
		emptyDiv.className = 'tabela-sem-colunas';
		emptyDiv.textContent = t('chive-chart-sidebar-empty');
		container.appendChild(emptyDiv);
		return;
	}

	const config = dataset.configGraficos || {
		bar: { enabled: false, expanded: false, category: null, sort: 'count-desc', topN: 10 },
		scatter: {
			enabled: false,
			expanded: false,
			x: null,
			y: null,
			xScale: 'linear',
			yScale: 'linear',
			radius: 3,
			opacity: 0.7,
		},
	};
	container.innerHTML = '';

	// Bar chart card
	createChartCard(
		container,
		'bar',
		config.bar.enabled,
		config.bar.expanded === true,
		t('chive-chart-toggle-bar'),
		t('chive-viz-category-comparison'),
		t('chive-viz-bar-desc'),
		PREVIEW_BAR_SVG,
		() => createBarChartControls(dataset, baseBar)
	);

	// Scatter plot card
	createChartCard(
		container,
		'scatter',
		config.scatter.enabled,
		config.scatter.expanded === true,
		t('chive-chart-toggle-scatter'),
		t('chive-viz-category-relationship'),
		t('chive-viz-scatter-desc'),
		PREVIEW_SCATTER_SVG,
		() => createScatterPlotControls(dataset, numericas)
	);

	// Setup event listeners for all controls
	setupChartControlListeners(dataset);
}

/**
 * Create a chart card UI element with toggle and controls
 * Uses proper textContent for all user-provided names
 * @private
 */
function createChartCard(container, chartName, enabled, expanded, label, category, description, previewSvg, controlsBuilder) {
	const article = document.createElement('article');
	article.className = enabled ? 'viz-card enabled' : 'viz-card';

	// Header
	const header = document.createElement('div');
	header.className = 'viz-card-header';

	const toggleLabel = document.createElement('label');
	toggleLabel.className = 'viz-toggle-linha';

	const checkbox = document.createElement('input');
	checkbox.id = `viz-toggle-${chartName}`;
	checkbox.className = 'coluna-checkbox';
	checkbox.type = 'checkbox';
	checkbox.checked = enabled;

	const labelSpan = document.createElement('span');
	labelSpan.className = 'coluna-nome';
	labelSpan.textContent = label; // textContent for XSS prevention

	const categoryTag = document.createElement('span');
	categoryTag.className = 'viz-category-tag';
	categoryTag.textContent = category; // textContent for XSS prevention

	toggleLabel.appendChild(checkbox);
	toggleLabel.appendChild(labelSpan);
	toggleLabel.appendChild(categoryTag);

	const previewDiv = document.createElement('div');
	previewDiv.className = 'viz-preview';
	previewDiv.innerHTML = previewSvg; // Safe: trusted SVG

	const expandBtn = document.createElement('button');
	expandBtn.id = `viz-expand-${chartName}`;
	expandBtn.className = 'viz-expand-btn';
	expandBtn.type = 'button';
	expandBtn.setAttribute('aria-expanded', String(expanded));
	expandBtn.textContent = expanded ? '▾' : '▸';

	header.appendChild(toggleLabel);
	header.appendChild(previewDiv);
	header.appendChild(expandBtn);

	// Description
	const desc = document.createElement('p');
	desc.className = 'viz-card-desc';
	desc.textContent = description; // textContent for XSS prevention

	// Body (controls)
	const body = document.createElement('div');
	body.id = `viz-body-${chartName}`;
	body.className = 'viz-card-body';
	if (!expanded) {
		body.hidden = true;
	}

	// Append controls from builder
	const controls = controlsBuilder();
	controls.forEach(control => body.appendChild(control));

	article.appendChild(header);
	article.appendChild(desc);
	article.appendChild(body);

	container.appendChild(article);

	// Event listeners handled by setupChartControlListeners
}

/**
 * Create bar chart control elements
 * @private
 */
function createBarChartControls(dataset, categoryOptions) {
	const config = dataset.configGraficos.bar;
	const controls = [];

	// Category select
	const categoryDiv = document.createElement('div');
	categoryDiv.className = 'chart-controle';

	const categoryLabel = document.createElement('label');
	categoryLabel.htmlFor = 'viz-select-bar';
	categoryLabel.textContent = t('chive-chart-control-bar-category');

	const categorySelect = document.createElement('select');
	categorySelect.id = 'viz-select-bar';
	categorySelect.className = 'linhas-select';
	categorySelect.disabled = !dataset.configGraficos.bar.enabled;

	const noneOption = document.createElement('option');
	noneOption.value = '';
	noneOption.textContent = t('chive-chart-option-none');
	categorySelect.appendChild(noneOption);

	categoryOptions.forEach(opt => {
		const option = document.createElement('option');
		option.value = opt;
		option.textContent = opt;
		option.selected = opt === config.category;
		categorySelect.appendChild(option);
	});

	categoryDiv.appendChild(categoryLabel);
	categoryDiv.appendChild(categorySelect);
	controls.push(categoryDiv);

	// Sort select
	const sortDiv = document.createElement('div');
	sortDiv.className = 'chart-controle';

	const sortLabel = document.createElement('label');
	sortLabel.htmlFor = 'viz-select-bar-sort';
	sortLabel.textContent = t('chive-chart-control-bar-sort');

	const sortSelect = document.createElement('select');
	sortSelect.id = 'viz-select-bar-sort';
	sortSelect.className = 'linhas-select';
	sortSelect.disabled = !dataset.configGraficos.bar.enabled;

	const sortOptions = [
		{ value: 'count-desc', label: t('chive-chart-sort-count-desc') },
		{ value: 'count-asc', label: t('chive-chart-sort-count-asc') },
		{ value: 'label-asc', label: t('chive-chart-sort-label-asc') },
		{ value: 'label-desc', label: t('chive-chart-sort-label-desc') },
	];

	sortOptions.forEach(opt => {
		const option = document.createElement('option');
		option.value = opt.value;
		option.textContent = opt.label;
		option.selected = opt.value === config.sort;
		sortSelect.appendChild(option);
	});

	sortDiv.appendChild(sortLabel);
	sortDiv.appendChild(sortSelect);
	controls.push(sortDiv);

	// Top N select
	const topnDiv = document.createElement('div');
	topnDiv.className = 'chart-controle';

	const topnLabel = document.createElement('label');
	topnLabel.htmlFor = 'viz-select-bar-topn';
	topnLabel.textContent = t('chive-chart-control-bar-topn');

	const topnSelect = document.createElement('select');
	topnSelect.id = 'viz-select-bar-topn';
	topnSelect.className = 'linhas-select';
	topnSelect.disabled = !dataset.configGraficos.bar.enabled;

	const topnOptions = [
		{ value: '0', label: t('chive-chart-topn-all') },
		{ value: '10', label: 'Top 10' },
		{ value: '20', label: 'Top 20' },
		{ value: '50', label: 'Top 50' },
	];

	topnOptions.forEach(opt => {
		const option = document.createElement('option');
		option.value = opt.value;
		option.textContent = opt.label;
		option.selected = String(config.topN) === opt.value;
		topnSelect.appendChild(option);
	});

	topnDiv.appendChild(topnLabel);
	topnDiv.appendChild(topnSelect);
	controls.push(topnDiv);

	return controls;
}

/**
 * Create scatter plot control elements
 * @private
 */
function createScatterPlotControls(dataset, numericOptions) {
	const config = dataset.configGraficos.scatter;
	const controls = [];

	const addSelect = (id, labelKey, optionsArray, selectedValue, disabled = false) => {
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
	};

	// X axis
	const xOptions = [
		{ value: '', label: t('chive-chart-option-none') },
		...numericOptions.map(opt => ({ value: opt, label: opt })),
	];
	controls.push(addSelect(
		'viz-select-x',
		'chive-chart-control-scatter-x',
		xOptions,
		config.x,
		!dataset.configGraficos.scatter.enabled
	));

	// Y axis
	const yOptions = [
		{ value: '', label: t('chive-chart-option-none') },
		...numericOptions.map(opt => ({ value: opt, label: opt })),
	];
	controls.push(addSelect(
		'viz-select-y',
		'chive-chart-control-scatter-y',
		yOptions,
		config.y,
		!dataset.configGraficos.scatter.enabled
	));

	// X scale
	const xScaleOptions = [
		{ value: 'linear', label: t('chive-chart-scale-linear') },
		{ value: 'log', label: t('chive-chart-scale-log') },
	];
	controls.push(addSelect(
		'viz-select-scatter-xscale',
		'chive-chart-control-scatter-xscale',
		xScaleOptions,
		config.xScale,
		!dataset.configGraficos.scatter.enabled
	));

	// Y scale
	const yScaleOptions = [
		{ value: 'linear', label: t('chive-chart-scale-linear') },
		{ value: 'log', label: t('chive-chart-scale-log') },
	];
	controls.push(addSelect(
		'viz-select-scatter-yscale',
		'chive-chart-control-scatter-yscale',
		yScaleOptions,
		config.yScale,
		!dataset.configGraficos.scatter.enabled
	));

	// Radius
	const radiusOptions = [
		{ value: '2', label: '2' },
		{ value: '3', label: '3' },
		{ value: '4', label: '4' },
		{ value: '6', label: '6' },
	];
	controls.push(addSelect(
		'viz-select-scatter-radius',
		'chive-chart-control-scatter-radius',
		radiusOptions,
		config.radius,
		!dataset.configGraficos.scatter.enabled
	));

	// Opacity
	const opacityOptions = [
		{ value: '0.3', label: '30%' },
		{ value: '0.5', label: '50%' },
		{ value: '0.7', label: '70%' },
		{ value: '1', label: '100%' },
	];
	controls.push(addSelect(
		'viz-select-scatter-opacity',
		'chive-chart-control-scatter-opacity',
		opacityOptions,
		config.opacity,
		!dataset.configGraficos.scatter.enabled
	));

	return controls;
}

/**
 * Setup all event listeners for chart controls
 * @private
 */
function setupChartControlListeners(dataset) {
	const colunasVisiveis = filterVisibleColumns(dataset);
	const numericas = getNumericColumnNames(colunasVisiveis);
	const categoricas = getCategoricalColumnNames(colunasVisiveis);
	const baseBar = categoricas.length > 0
		? categoricas
		: colunasVisiveis.map(coluna => coluna.nome);

	// Bar chart toggle
	const toggleBar = document.getElementById('viz-toggle-bar');
	const expandBar = document.getElementById('viz-expand-bar');

	if (toggleBar) {
		toggleBar.addEventListener('change', () => {
			const categoriaAtual = dataset.configGraficos.bar?.category;
			const categoriaPadrao = baseBar.includes(categoriaAtual)
				? categoriaAtual
				: (baseBar[0] || null);
			updateActiveDatasetChartConfig({
				bar: {
					...dataset.configGraficos.bar,
					enabled: toggleBar.checked,
					category: toggleBar.checked ? categoriaPadrao : categoriaAtual,
					expanded: toggleBar.checked ? true : dataset.configGraficos.bar?.expanded === true,
				},
			});
			if (onChartConfigChangeCallback) onChartConfigChangeCallback();
		});
	}

	if (expandBar) {
		expandBar.addEventListener('click', () => {
			const expanded = expandBar.getAttribute('aria-expanded') === 'true';
			updateActiveDatasetChartConfig({
				bar: {
					...dataset.configGraficos.bar,
					expanded: !expanded,
				},
			});
			if (onChartConfigChangeCallback) onChartConfigChangeCallback();
		});
	}

	// Scatter chart toggle
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
			if (onChartConfigChangeCallback) onChartConfigChangeCallback();
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
			if (onChartConfigChangeCallback) onChartConfigChangeCallback();
		});
	}

	// Bar chart controls
	const selectBar = document.getElementById('viz-select-bar');
	if (selectBar) {
		selectBar.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				bar: {
					...dataset.configGraficos.bar,
					category: selectBar.value,
				},
			});
			if (onChartConfigChangeCallback) onChartConfigChangeCallback();
		});
	}

	const selectBarSort = document.getElementById('viz-select-bar-sort');
	if (selectBarSort) {
		selectBarSort.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				bar: {
					...dataset.configGraficos.bar,
					sort: selectBarSort.value,
				},
			});
			if (onChartConfigChangeCallback) onChartConfigChangeCallback();
		});
	}

	const selectBarTopN = document.getElementById('viz-select-bar-topn');
	if (selectBarTopN) {
		selectBarTopN.addEventListener('change', () => {
			updateActiveDatasetChartConfig({
				bar: {
					...dataset.configGraficos.bar,
					topN: Number(selectBarTopN.value),
				},
			});
			if (onChartConfigChangeCallback) onChartConfigChangeCallback();
		});
	}

	// Scatter chart controls
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
				if (onChartConfigChangeCallback) onChartConfigChangeCallback();
			});
		}
	});
}
