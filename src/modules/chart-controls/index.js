/**
 * CHIVE Chart Controls Manager
 * 
 * Handles visualization controls in the sidebar:
 * - Chart toggle checkboxes
 * - Configuration selects (category, sort, scale, etc.)
 * - Chart expand/collapse buttons
 * - Event listeners for control changes
 */

import { t } from '../../services/i18nService.js';
import {
	filterVisibleColumns,
	getNumericColumnNames,
	getCategoricalColumnNames,
} from '../../utils/columnHelpers.js';
import { mergeChartConfigWithDefaults } from '../../config/chartDefaults.js';
import { onStateChange } from '../appState.js';
import { createBarChartControls, setupBarChartControlListeners } from './barControls.js';
import { createBubbleChartControls, setupBubbleChartControlListeners } from './bubbleControls.js';
import { createNetworkGraphControls, setupNetworkGraphControlListeners } from './networkControls.js';
import { createScatterPlotControls, setupScatterPlotControlListeners } from './scatterControls.js';
import { createPieChartControls, setupPieChartControlListeners } from './pieControls.js';
import { createTreeMapControls, setupTreeMapControlListeners } from './treemapControls.js';
import { createChartCard } from './cardFactory.js';
import { PREVIEW_BAR_SVG, PREVIEW_BUBBLE_SVG, PREVIEW_NETWORK_SVG, PREVIEW_PIE_SVG, PREVIEW_SCATTER_SVG, PREVIEW_TREEMAP_SVG } from './previews.js';

// Callback when chart config changes (will be set by main.js)
let onChartConfigChangeCallback = null;

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
	const todasColunas = colunasVisiveis.map(coluna => coluna.nome);
	const baseBar = categoricas.length > 0
		? categoricas
		: colunasVisiveis.map(coluna => coluna.nome);
	const basePie = categoricas.length > 0
		? categoricas
		: colunasVisiveis.map(coluna => coluna.nome);
	const baseBubble = categoricas.length > 0
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

	const config = mergeChartConfigWithDefaults(dataset.configGraficos);
	dataset.configGraficos = config;
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
		() => createBarChartControls(dataset, baseBar, numericas, todasColunas)
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
		() => createScatterPlotControls(dataset, numericas, todasColunas)
	);

	createChartCard(
		container,
		'pie',
		config.pie.enabled,
		config.pie.expanded === true,
		t('chive-chart-toggle-pie'),
		t('chive-viz-category-composition'),
		t('chive-viz-pie-desc'),
		PREVIEW_PIE_SVG,
		() => createPieChartControls(dataset, basePie, numericas, todasColunas)
	);

	createChartCard(
		container,
		'bubble',
		config.bubble.enabled,
		config.bubble.expanded === true,
		t('chive-chart-toggle-bubble'),
		t('chive-viz-category-hierarchy'),
		t('chive-viz-bubble-desc'),
		PREVIEW_BUBBLE_SVG,
		() => createBubbleChartControls(dataset, baseBubble, numericas, todasColunas)
	);


	createChartCard(
		container,
		'network',
		config.network.enabled,
		config.network.expanded === true,
		t('chive-chart-toggle-network'),
		t('chive-viz-category-relationship'),
		t('chive-viz-network-desc'),
		PREVIEW_NETWORK_SVG,
		() => createNetworkGraphControls(dataset, todasColunas, numericas, categoricas)
	);

	createChartCard(
		container,
		'treemap',
		config.treemap.enabled,
		config.treemap.expanded === true,
		t('chive-chart-toggle-treemap'),
		t('chive-viz-category-composition'),
		t('chive-viz-treemap-desc'),
		PREVIEW_TREEMAP_SVG,
		() => createTreeMapControls(dataset, categoricas.length > 0 ? categoricas : todasColunas, numericas, todasColunas)
	);

	// Setup event listeners for all controls
	setupChartControlListeners(dataset, baseBar, numericas, basePie, baseBubble, todasColunas);
}

/**
 * Create bar chart control elements
 * @private
 */
function setupChartControlListeners(dataset, baseBar, numericas, basePie, baseBubble, todasColunas) {
	setupBarChartControlListeners(dataset, baseBar, numericas, todasColunas, onChartConfigChangeCallback);
	setupBubbleChartControlListeners(dataset, baseBubble, numericas, todasColunas, onChartConfigChangeCallback);
	setupNetworkGraphControlListeners(dataset, todasColunas, numericas, onChartConfigChangeCallback);
	setupScatterPlotControlListeners(dataset, numericas, todasColunas, onChartConfigChangeCallback);
	setupPieChartControlListeners(dataset, basePie, numericas, todasColunas, onChartConfigChangeCallback);
	const categoricasAll = getCategoricalColumnNames(filterVisibleColumns(dataset));
	setupTreeMapControlListeners(dataset, categoricasAll.length > 0 ? categoricasAll : todasColunas, numericas, todasColunas, onChartConfigChangeCallback);
}
