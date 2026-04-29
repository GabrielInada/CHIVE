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
import { onStateChange, STATE_EVENTS } from '../appState.js';
import { createBarChartControls, setupBarChartControlListeners } from './barControls.js';
import { createBubbleChartControls, setupBubbleChartControlListeners } from './bubbleControls.js';
import { createNetworkGraphControls, setupNetworkGraphControlListeners } from './networkControls.js';
import { createScatterPlotControls, setupScatterPlotControlListeners } from './scatterControls.js';
import { createPieChartControls, setupPieChartControlListeners } from './pieControls.js';
import { createTreeMapControls, setupTreeMapControlListeners } from './treemapControls.js';
import { createChartCard } from './cardFactory.js';
import { PREVIEW_BAR_SVG, PREVIEW_BUBBLE_SVG, PREVIEW_NETWORK_SVG, PREVIEW_PIE_SVG, PREVIEW_SCATTER_SVG, PREVIEW_TREEMAP_SVG } from './previews.js';

import { setLiveRenderCallback } from './livePreview.js';

// Callback when chart config changes (will be set by main.js)
let onChartConfigChangeCallback = null;
const trackedSidebarContainers = new WeakSet();
let lastSidebarInteractionAnchor = null;
const SIDEBAR_INTERACTION_MAX_AGE_MS = 2000;

/**
 * Initialize chart controls manager
 * @param {Function} configChangeCallback - Called when config changes
 * @param {Function} liveRenderCallback - Called during live previews (e.g. dragging
 *   a color picker) to redraw charts without re-rendering the controls sidebar.
 */
export function initChartControls(configChangeCallback = null, liveRenderCallback = null) {
	onChartConfigChangeCallback = configChangeCallback;
	setLiveRenderCallback(liveRenderCallback);

	// Re-render when expanded state changes
	onStateChange(STATE_EVENTS.CHART_EXPANDED_CHANGED, handleChartExpandedChange);
}

/**
 * Handle chart expanded state change
 * @private
 */
function handleChartExpandedChange() {
	// State changed, re-render if needed
	// Main.js will call renderChartControlsSidebar on full refresh
}

function getChartNameFromExpandButtonId(id) {
	if (typeof id !== 'string') return null;
	return id.startsWith('viz-expand-') ? id.slice('viz-expand-'.length) : null;
}

function captureControlSectionExpansionState(container) {
	if (!container || typeof container.querySelectorAll !== 'function') return {};

	const state = {};
	const cards = container.querySelectorAll('.viz-card');
	cards.forEach(card => {
		const expandButton = card.querySelector('.viz-expand-btn');
		const chartName = getChartNameFromExpandButtonId(expandButton?.id);
		if (!chartName) return;

		const sectionState = {};
		const sections = card.querySelectorAll('.chart-control-section');
		sections.forEach(section => {
			const sectionId = section.dataset.section;
			const header = section.querySelector('.chart-section-header');
			if (!sectionId || !header) return;
			sectionState[sectionId] = header.getAttribute('aria-expanded') === 'true';
		});

		if (Object.keys(sectionState).length > 0) {
			state[chartName] = sectionState;
		}
	});

	return state;
}

function applyControlSectionExpansionState(container, state) {
	if (!container || typeof container.querySelector !== 'function' || !state) return;

	Object.entries(state).forEach(([chartName, sectionState]) => {
		const expandButton = container.querySelector(`#viz-expand-${chartName}`);
		const card = expandButton?.closest('.viz-card');
		if (!card) return;

		Object.entries(sectionState).forEach(([sectionId, expanded]) => {
			const section = card.querySelector(`.chart-control-section[data-section="${sectionId}"]`);
			if (!section) return;

			const header = section.querySelector('.chart-section-header');
			const content = section.querySelector('.chart-section-content');
			const toggleIcon = section.querySelector('.chart-section-toggle');
			if (!header || !content) return;

			header.setAttribute('aria-expanded', String(expanded));
			content.style.display = expanded ? 'block' : 'none';
			if (toggleIcon) {
				toggleIcon.textContent = expanded ? '▼' : '▶';
			}
		});
	});
}

function ensureSidebarInteractionTracking(container) {
	if (!container || typeof container.addEventListener !== 'function') return;
	if (trackedSidebarContainers.has(container)) return;

	const captureInteractionAnchor = (event) => {
		const target = event?.target;
		if (!(target instanceof HTMLElement)) return;
		if (typeof container.contains === 'function' && !container.contains(target)) return;

		const activeCard = target.closest('.viz-card');
		const expandButton = activeCard?.querySelector('.viz-expand-btn');
		lastSidebarInteractionAnchor = {
			targetId: target.id || null,
			targetTop: target.getBoundingClientRect().top,
			activeCardExpandButtonId: expandButton?.id || null,
			activeCardTop: activeCard ? activeCard.getBoundingClientRect().top : null,
			timestamp: Date.now(),
		};
	};

	container.addEventListener('change', captureInteractionAnchor, true);
	container.addEventListener('input', captureInteractionAnchor, true);
	container.addEventListener('click', captureInteractionAnchor, true);
	trackedSidebarContainers.add(container);
}

function getSidebarScrollAnchor(container) {
	const previousScrollTop = Number(container?.scrollTop || 0);
	const hasRecentInteraction = lastSidebarInteractionAnchor
		&& (Date.now() - lastSidebarInteractionAnchor.timestamp) <= SIDEBAR_INTERACTION_MAX_AGE_MS;

	if (hasRecentInteraction) {
		return {
			previousScrollTop,
			activeElementId: lastSidebarInteractionAnchor.targetId || null,
			activeElementTop: lastSidebarInteractionAnchor.targetTop,
			activeCardExpandButtonId: lastSidebarInteractionAnchor.activeCardExpandButtonId || null,
			activeCardTop: lastSidebarInteractionAnchor.activeCardTop,
		};
	}

	const activeElement = document.activeElement;
	const canCheckContainment = typeof container?.contains === 'function';
	const isAnchoredElement = canCheckContainment
		&& activeElement instanceof HTMLElement
		&& container.contains(activeElement);

	if (!isAnchoredElement) {
		return { previousScrollTop };
	}

	const activeCard = activeElement.closest('.viz-card');
	const expandButton = activeCard?.querySelector('.viz-expand-btn');

	return {
		previousScrollTop,
		activeElementId: activeElement.id || null,
		activeElementTop: activeElement.getBoundingClientRect().top,
		activeCardExpandButtonId: expandButton?.id || null,
		activeCardTop: activeCard ? activeCard.getBoundingClientRect().top : null,
	};
}

function restoreSidebarScrollPosition(container, anchor) {
	if (!anchor) return;

	const canCheckContainment = typeof container?.contains === 'function';
	// Baseline must be the CURRENT scrollTop (post-wipe), not the previous one.
	// Real browsers clamp scrollTop to 0 when innerHTML is wiped (scrollHeight drops
	// below scrollTop + clientHeight), so the delta from the anchor's captured rect
	// already accounts for the original scroll offset. jsdom doesn't reset scrollTop,
	// so this also stays correct there (current == previous).
	const readCurrentScrollTop = () => Number(container?.scrollTop || 0);

	if (anchor.activeElementId && Number.isFinite(anchor.activeElementTop)) {
		const nextActiveElement = document.getElementById(anchor.activeElementId);
		const elementIsInsideContainer = canCheckContainment
			&& nextActiveElement instanceof HTMLElement
			&& container.contains(nextActiveElement);
		if (elementIsInsideContainer) {
			const delta = nextActiveElement.getBoundingClientRect().top - anchor.activeElementTop;
			container.scrollTop = readCurrentScrollTop() + delta;
			if (typeof nextActiveElement.focus === 'function') {
				try {
					nextActiveElement.focus({ preventScroll: true });
				} catch {
					nextActiveElement.focus();
				}
			}
			return;
		}
	}

	if (anchor.activeCardExpandButtonId && Number.isFinite(anchor.activeCardTop)) {
		const nextExpandButton = document.getElementById(anchor.activeCardExpandButtonId);
		const nextCard = nextExpandButton?.closest('.viz-card');
		if (nextCard) {
			const delta = nextCard.getBoundingClientRect().top - anchor.activeCardTop;
			container.scrollTop = readCurrentScrollTop() + delta;
			return;
		}
	}

	container.scrollTop = Number(anchor.previousScrollTop || 0);
}

/**
 * Render chart controls sidebar
 * @param {Object} dataset - Active dataset
 */
export function renderChartControlsSidebar(dataset) {
	const container = document.getElementById('lista-visualizacoes-conteudo');
	if (!container) return;
	ensureSidebarInteractionTracking(container);
	const scrollAnchor = getSidebarScrollAnchor(container);
	const controlSectionState = captureControlSectionExpansionState(container);

	if (!dataset) {
		container.innerHTML = '';
		const emptyDiv = document.createElement('div');
		emptyDiv.className = 'tabela-sem-colunas';
		emptyDiv.textContent = t('chive-chart-sidebar-empty');
		container.appendChild(emptyDiv);
		restoreSidebarScrollPosition(container, scrollAnchor);
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
		restoreSidebarScrollPosition(container, scrollAnchor);
		return;
	}

	// Caller (main.js refreshView) normalizes dataset.configGraficos via
	// normalizeActiveDatasetConfig before invoking us, so we just read it.
	const config = mergeChartConfigWithDefaults(dataset.configGraficos);
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
	applyControlSectionExpansionState(container, controlSectionState);

	// Setup event listeners for all controls
	setupChartControlListeners(dataset, baseBar, numericas, basePie, baseBubble, todasColunas);
	restoreSidebarScrollPosition(container, scrollAnchor);
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
