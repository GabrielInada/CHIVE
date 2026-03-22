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
import { mergeChartConfigWithDefaults } from './chartConfigDefaults.js';
import { onStateChange } from './appState.js';
import { createBarChartControls, setupBarChartControlListeners } from './chart-controls/barControls.js';
import { createNetworkGraphControls, setupNetworkGraphControlListeners } from './chart-controls/networkControls.js';
import { createScatterPlotControls, setupScatterPlotControlListeners } from './chart-controls/scatterControls.js';
import { createPieChartControls, setupPieChartControlListeners } from './chart-controls/pieControls.js';

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

const PREVIEW_NETWORK_SVG = `
	<svg viewBox="0 0 84 38" aria-hidden="true">
		<line x1="14" y1="10" x2="40" y2="17" stroke="#8da3ba" stroke-width="1.6"></line>
		<line x1="40" y1="17" x2="67" y2="9" stroke="#8da3ba" stroke-width="1.6"></line>
		<line x1="24" y1="30" x2="40" y2="17" stroke="#8da3ba" stroke-width="1.6"></line>
		<line x1="40" y1="17" x2="62" y2="29" stroke="#8da3ba" stroke-width="1.6"></line>
		<circle cx="14" cy="10" r="3.2" fill="#3b6a9f"></circle>
		<circle cx="40" cy="17" r="3.8" fill="#3b6a9f"></circle>
		<circle cx="67" cy="9" r="3" fill="#3b6a9f"></circle>
		<circle cx="24" cy="30" r="2.8" fill="#3b6a9f"></circle>
		<circle cx="62" cy="29" r="2.8" fill="#3b6a9f"></circle>
	</svg>
`;

const PREVIEW_PIE_SVG = `
	<svg viewBox="0 0 84 38" aria-hidden="true">
		<circle class="no-fill" cx="24" cy="19" r="12" stroke-width="8" stroke="#8ea857" stroke-dasharray="30 46"></circle>
		<circle class="no-fill" cx="24" cy="19" r="12" stroke-width="8" stroke="#d4622a" stroke-dasharray="16 60" stroke-dashoffset="-30"></circle>
		<circle class="no-fill" cx="24" cy="19" r="12" stroke-width="8" stroke="#1a472a" stroke-dasharray="14 62" stroke-dashoffset="-46"></circle>
		<circle class="no-fill" cx="56" cy="19" r="12" stroke-width="8" stroke="#8ea857"></circle>
		<circle cx="56" cy="19" r="5" fill="#fffef9"></circle>
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
	const todasColunas = colunasVisiveis.map(coluna => coluna.nome);
	const baseBar = categoricas.length > 0
		? categoricas
		: colunasVisiveis.map(coluna => coluna.nome);
	const basePie = categoricas.length > 0
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
		'pie',
		config.pie.enabled,
		config.pie.expanded === true,
		t('chive-chart-toggle-pie'),
		t('chive-viz-category-composition'),
		t('chive-viz-pie-desc'),
		PREVIEW_PIE_SVG,
		() => createPieChartControls(dataset, basePie, numericas)
	);

	// Setup event listeners for all controls
	setupChartControlListeners(dataset, baseBar, numericas, basePie, todasColunas);
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
function setupChartControlListeners(dataset, baseBar, numericas, basePie, todasColunas) {
	setupBarChartControlListeners(dataset, baseBar, onChartConfigChangeCallback);
	setupNetworkGraphControlListeners(dataset, todasColunas, onChartConfigChangeCallback);
	setupScatterPlotControlListeners(dataset, numericas, onChartConfigChangeCallback);
	setupPieChartControlListeners(dataset, basePie, numericas, onChartConfigChangeCallback);
}
