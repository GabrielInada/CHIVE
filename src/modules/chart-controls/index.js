/**
 * CHIVE Chart Controls Manager
 *
 * Handles visualization controls in the sidebar:
 * - Chart-type list (top pane) — radio selection of the active chart
 * - Params pane (bottom) — controls for the currently active chart
 * - Centralized activation defaults (column selection on chart switch)
 */

import { t } from '../../services/i18nService.js';
import {
	filterVisibleColumns,
	getNumericColumnNames,
	getCategoricalColumnNames,
	getDateColumnNames,
} from '../../utils/columnHelpers.js';
import { mergeChartConfigWithDefaults } from '../../config/chartDefaults.js';
import { setActiveChartType } from '../appState.js';
import { createBarChartControls, setupBarChartControlListeners, computeDefaults as computeBarDefaults } from './barControls.js';
import { createBubbleChartControls, setupBubbleChartControlListeners, computeDefaults as computeBubbleDefaults } from './bubbleControls.js';
import { createLineChartControls, setupLineChartControlListeners, computeDefaults as computeLineDefaults } from './lineControls.js';
import { createNetworkGraphControls, setupNetworkGraphControlListeners, computeDefaults as computeNetworkDefaults } from './networkControls.js';
import { createScatterPlotControls, setupScatterPlotControlListeners, computeDefaults as computeScatterDefaults } from './scatterControls.js';
import { createPieChartControls, setupPieChartControlListeners, computeDefaults as computePieDefaults } from './pieControls.js';
import { createTreeMapControls, setupTreeMapControlListeners, computeDefaults as computeTreemapDefaults } from './treemapControls.js';
import { CHART_TYPES } from './chartTypes.js';
import { renderChartParamsDOM } from '../../components/results/chartParamsView.js';
import { openChartTypePickerDialog } from '../../components/results/chartTypePickerDialog.js';

import { setLiveRenderCallback } from './livePreview.js';

let onChartConfigChangeCallback = null;
const trackedSidebarContainers = new WeakSet();
let lastSidebarInteractionAnchor = null;
const SIDEBAR_INTERACTION_MAX_AGE_MS = 2000;

export function initChartControls(configChangeCallback = null, liveRenderCallback = null) {
	onChartConfigChangeCallback = configChangeCallback;
	setLiveRenderCallback(liveRenderCallback);
}

function captureControlSectionExpansionState(container) {
	if (!container || typeof container.querySelectorAll !== 'function') return {};
	const state = {};
	const sections = container.querySelectorAll('.chart-control-section');
	sections.forEach(section => {
		const sectionId = section.dataset.section;
		const header = section.querySelector('.chart-section-header');
		if (!sectionId || !header) return;
		state[sectionId] = header.getAttribute('aria-expanded') === 'true';
	});
	return state;
}

function applyControlSectionExpansionState(container, state) {
	if (!container || typeof container.querySelector !== 'function' || !state) return;
	Object.entries(state).forEach(([sectionId, expanded]) => {
		const section = container.querySelector(`.chart-control-section[data-section="${sectionId}"]`);
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
}

function ensureSidebarInteractionTracking(container) {
	if (!container || typeof container.addEventListener !== 'function') return;
	if (trackedSidebarContainers.has(container)) return;

	const captureInteractionAnchor = (event) => {
		const target = event?.target;
		if (!(target instanceof HTMLElement)) return;
		if (typeof container.contains === 'function' && !container.contains(target)) return;
		lastSidebarInteractionAnchor = {
			targetId: target.id || null,
			targetTop: target.getBoundingClientRect().top,
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

	return {
		previousScrollTop,
		activeElementId: activeElement.id || null,
		activeElementTop: activeElement.getBoundingClientRect().top,
	};
}

function restoreSidebarScrollPosition(container, anchor) {
	if (!anchor) return;
	const canCheckContainment = typeof container?.contains === 'function';
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

	container.scrollTop = Number(anchor.previousScrollTop || 0);
}

// Derives the column buckets each per-chart controls file needs. Computed once
// per call site so the registry entries below stay small.
function getColumnContext(dataset) {
	const colunasVisiveis = filterVisibleColumns(dataset);
	const numericas = getNumericColumnNames(colunasVisiveis);
	const categoricas = getCategoricalColumnNames(colunasVisiveis);
	const datas = getDateColumnNames(colunasVisiveis);
	const todasColunas = colunasVisiveis.map(c => c.nome);
	const baseCategoricalOrAll = categoricas.length > 0 ? categoricas : todasColunas;
	return { numericas, categoricas, datas, todasColunas, baseCategoricalOrAll };
}

// Per-chart wiring table: adapts the unified `(dataset, ctx, cb?)` shape to
// each per-chart file's factory signature, and points at the file's own
// activation-defaults resolver. The per-chart files own the chart-specific
// logic; this table is pure wiring.
const CHART_CONTROL_REGISTRY = {
	bar: {
		build: (ds, ctx) => createBarChartControls(ds, ctx.baseCategoricalOrAll, ctx.numericas, ctx.todasColunas),
		attachListeners: (ds, ctx, cb) => setupBarChartControlListeners(ds, ctx.baseCategoricalOrAll, ctx.numericas, ctx.todasColunas, cb),
		computeDefaults: computeBarDefaults,
	},
	scatter: {
		build: (ds, ctx) => createScatterPlotControls(ds, ctx.numericas, ctx.todasColunas),
		attachListeners: (ds, ctx, cb) => setupScatterPlotControlListeners(ds, ctx.numericas, ctx.todasColunas, cb),
		computeDefaults: computeScatterDefaults,
	},
	pie: {
		build: (ds, ctx) => createPieChartControls(ds, ctx.baseCategoricalOrAll, ctx.numericas, ctx.todasColunas),
		attachListeners: (ds, ctx, cb) => setupPieChartControlListeners(ds, ctx.baseCategoricalOrAll, ctx.numericas, ctx.todasColunas, cb),
		computeDefaults: computePieDefaults,
	},
	bubble: {
		build: (ds, ctx) => createBubbleChartControls(ds, ctx.baseCategoricalOrAll, ctx.numericas, ctx.todasColunas),
		attachListeners: (ds, ctx, cb) => setupBubbleChartControlListeners(ds, ctx.baseCategoricalOrAll, ctx.numericas, ctx.todasColunas, cb),
		computeDefaults: computeBubbleDefaults,
	},
	network: {
		build: (ds, ctx) => createNetworkGraphControls(ds, ctx.todasColunas, ctx.numericas, ctx.categoricas),
		attachListeners: (ds, ctx, cb) => setupNetworkGraphControlListeners(ds, ctx.todasColunas, ctx.numericas, cb),
		computeDefaults: computeNetworkDefaults,
	},
	treemap: {
		build: (ds, ctx) => createTreeMapControls(ds, ctx.baseCategoricalOrAll, ctx.numericas, ctx.todasColunas),
		attachListeners: (ds, ctx, cb) => setupTreeMapControlListeners(ds, ctx.baseCategoricalOrAll, ctx.numericas, ctx.todasColunas, cb),
		computeDefaults: computeTreemapDefaults,
	},
	line: {
		build: (ds, ctx) => createLineChartControls(ds, ctx.numericas, ctx.datas, ctx.todasColunas),
		attachListeners: (ds, ctx, cb) => setupLineChartControlListeners(ds, ctx.numericas, ctx.datas, ctx.todasColunas, cb),
		computeDefaults: computeLineDefaults,
	},
};

// Resolves "first-time activation" defaults for each chart type. The active
// chart's existing config wins when still valid; falls back to first available
// column otherwise. Test entry point — accepts a pre-built column context.
function computeActivationDefaults(chartType, dataset, { numericas, categoricas, todasColunas, datas = [] }) {
	const entry = CHART_CONTROL_REGISTRY[chartType];
	if (!entry) return {};
	const baseCategoricalOrAll = categoricas.length > 0 ? categoricas : todasColunas;
	return entry.computeDefaults(dataset, { numericas, categoricas, todasColunas, datas, baseCategoricalOrAll });
}

function buildControlsForChart(chartType, dataset) {
	const entry = CHART_CONTROL_REGISTRY[chartType];
	if (!entry) return [];
	return entry.build(dataset, getColumnContext(dataset));
}

function setupListenersForChart(chartType, dataset) {
	const entry = CHART_CONTROL_REGISTRY[chartType];
	if (!entry) return;
	entry.attachListeners(dataset, getColumnContext(dataset), onChartConfigChangeCallback);
}

function handleChartTypeSelect(chartType, dataset) {
	if (chartType === null) {
		setActiveChartType(null);
		onChartConfigChangeCallback?.();
		return;
	}
	const entry = CHART_CONTROL_REGISTRY[chartType];
	const defaults = entry ? entry.computeDefaults(dataset, getColumnContext(dataset)) : {};
	setActiveChartType(chartType, { ...defaults, expanded: true });
	onChartConfigChangeCallback?.();
}

// Exported for tests so the activation-defaults logic can be exercised
// without bootstrapping a full sidebar render.
export { computeActivationDefaults, handleChartTypeSelect };

function openPickerForDataset(activeChartType, dataset) {
	openChartTypePickerDialog({ activeChartType, translate: t }).then(result => {
		if (result === null) return;
		handleChartTypeSelect(result.chartType, dataset);
	});
}

export function renderChartControlsSidebar(dataset) {
	const paramsContainer = document.getElementById('viz-chart-params');
	if (!paramsContainer) return;

	ensureSidebarInteractionTracking(paramsContainer);
	const scrollAnchor = getSidebarScrollAnchor(paramsContainer);
	const controlSectionState = captureControlSectionExpansionState(paramsContainer);

	const emptyState = (message) => {
		paramsContainer.replaceChildren();
		const emptyDiv = document.createElement('div');
		emptyDiv.className = 'tabela-sem-colunas';
		emptyDiv.textContent = message;
		paramsContainer.appendChild(emptyDiv);
	};

	if (!dataset) {
		emptyState(t('chive-chart-sidebar-empty'));
		restoreSidebarScrollPosition(paramsContainer, scrollAnchor);
		return;
	}

	const colunasVisiveis = filterVisibleColumns(dataset);
	if (colunasVisiveis.length === 0) {
		emptyState(t('chive-chart-sidebar-empty'));
		restoreSidebarScrollPosition(paramsContainer, scrollAnchor);
		return;
	}

	const config = mergeChartConfigWithDefaults(dataset.configGraficos);
	const activeChartType = CHART_TYPES.find(type => config[type].enabled) || null;

	const controls = activeChartType ? buildControlsForChart(activeChartType, dataset) : [];

	renderChartParamsDOM({
		container: paramsContainer,
		activeChartType,
		chartTitle: activeChartType ? t(`chive-chart-toggle-${activeChartType}`) : '',
		chartDescription: activeChartType ? t(`chive-viz-${activeChartType}-desc`) : '',
		controls,
		translate: t,
		onChartTypeTriggerClick: () => openPickerForDataset(activeChartType, dataset),
	});

	if (activeChartType) {
		applyControlSectionExpansionState(paramsContainer, controlSectionState);
		setupListenersForChart(activeChartType, dataset);
	}

	restoreSidebarScrollPosition(paramsContainer, scrollAnchor);
}
