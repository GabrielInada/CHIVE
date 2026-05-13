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
import { createBarChartControls, setupBarChartControlListeners } from './barControls.js';
import { createBubbleChartControls, setupBubbleChartControlListeners } from './bubbleControls.js';
import { createLineChartControls, setupLineChartControlListeners } from './lineControls.js';
import { createNetworkGraphControls, setupNetworkGraphControlListeners } from './networkControls.js';
import { createScatterPlotControls, setupScatterPlotControlListeners } from './scatterControls.js';
import { createPieChartControls, setupPieChartControlListeners } from './pieControls.js';
import { createTreeMapControls, setupTreeMapControlListeners } from './treemapControls.js';
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

function pickPreferred(options, preferredIndex = 0, avoid = null) {
	const filtered = options.filter(opt => opt !== avoid);
	return filtered[preferredIndex] ?? filtered[0] ?? null;
}

// Resolves "first-time activation" defaults for each chart type. The active
// chart's existing config wins when still valid; falls back to first available
// column otherwise. Mirrors the per-chart defaulting that used to live in each
// toggle-change handler.
function computeActivationDefaults(chartType, dataset, { numericas, categoricas, todasColunas, datas = [] }) {
	const config = dataset.configGraficos || {};
	const baseCategoricalOrAll = categoricas.length > 0 ? categoricas : todasColunas;

	switch (chartType) {
		case 'bar': {
			const current = config.bar?.category;
			const category = baseCategoricalOrAll.includes(current)
				? current
				: (baseCategoricalOrAll[0] || null);
			return { category };
		}

		case 'pie': {
			const currentCat = config.pie?.category;
			const currentVal = config.pie?.valueColumn;
			return {
				category: baseCategoricalOrAll.includes(currentCat)
					? currentCat
					: (baseCategoricalOrAll[0] || null),
				valueColumn: numericas.includes(currentVal) ? currentVal : (numericas[0] || null),
			};
		}

		case 'bubble': {
			const currentCat = config.bubble?.category;
			const currentVal = config.bubble?.valueColumn;
			const measureMode = config.bubble?.measureMode;
			const valueColumn = measureMode !== 'count'
				? (numericas.includes(currentVal) ? currentVal : (numericas[0] || null))
				: currentVal;
			return {
				category: baseCategoricalOrAll.includes(currentCat)
					? currentCat
					: (baseCategoricalOrAll[0] || null),
				valueColumn,
			};
		}

		case 'scatter': {
			const currentX = config.scatter?.x;
			const currentY = config.scatter?.y;
			const numericInAll = numericas.filter(opt => todasColunas.includes(opt));
			const xPadrao = todasColunas.includes(currentX)
				? currentX
				: (numericInAll[0] ?? todasColunas[0] ?? null);
			const yPadrao = todasColunas.includes(currentY) && currentY !== xPadrao
				? currentY
				: (pickPreferred(numericInAll, 1, xPadrao) ?? pickPreferred(todasColunas, 0, xPadrao) ?? xPadrao);
			const currentXScale = config.scatter?.xScale === 'log' ? 'log' : 'linear';
			const currentYScale = config.scatter?.yScale === 'log' ? 'log' : 'linear';
			return {
				x: xPadrao,
				y: yPadrao,
				xScale: numericas.includes(xPadrao) ? currentXScale : 'linear',
				yScale: numericas.includes(yPadrao) ? currentYScale : 'linear',
			};
		}

		case 'network': {
			const currentSource = config.network?.source;
			const currentTarget = config.network?.target;
			const sourcePadrao = todasColunas.includes(currentSource)
				? currentSource
				: (todasColunas[0] || null);
			const targetPadrao = todasColunas.includes(currentTarget)
				? currentTarget
				: (todasColunas[1] || todasColunas[0] || null);
			return { source: sourcePadrao, target: targetPadrao };
		}

		case 'treemap': {
			const current = config.treemap?.category;
			return {
				category: baseCategoricalOrAll.includes(current)
					? current
					: (baseCategoricalOrAll[0] || null),
			};
		}

		case 'line': {
			const currentX = config.line?.x;
			const currentY = config.line?.y;
			const xDefault = todasColunas.includes(currentX)
				? currentX
				: (datas[0] ?? numericas[0] ?? todasColunas[0] ?? null);
			const yCandidates = numericas.filter(name => name !== xDefault);
			const yDefault = numericas.includes(currentY) && currentY !== xDefault
				? currentY
				: (yCandidates[0] ?? numericas[0] ?? null);
			return { x: xDefault, y: yDefault };
		}

		default:
			return {};
	}
}

function buildControlsForChart(chartType, dataset) {
	const colunasVisiveis = filterVisibleColumns(dataset);
	const numericas = getNumericColumnNames(colunasVisiveis);
	const categoricas = getCategoricalColumnNames(colunasVisiveis);
	const datas = getDateColumnNames(colunasVisiveis);
	const todasColunas = colunasVisiveis.map(c => c.nome);
	const baseCategoricalOrAll = categoricas.length > 0 ? categoricas : todasColunas;

	switch (chartType) {
		case 'bar':
			return createBarChartControls(dataset, baseCategoricalOrAll, numericas, todasColunas);
		case 'scatter':
			return createScatterPlotControls(dataset, numericas, todasColunas);
		case 'pie':
			return createPieChartControls(dataset, baseCategoricalOrAll, numericas, todasColunas);
		case 'bubble':
			return createBubbleChartControls(dataset, baseCategoricalOrAll, numericas, todasColunas);
		case 'network':
			return createNetworkGraphControls(dataset, todasColunas, numericas, categoricas);
		case 'treemap':
			return createTreeMapControls(dataset, baseCategoricalOrAll, numericas, todasColunas);
		case 'line':
			return createLineChartControls(dataset, numericas, datas, todasColunas);
		default:
			return [];
	}
}

function setupListenersForChart(chartType, dataset) {
	const colunasVisiveis = filterVisibleColumns(dataset);
	const numericas = getNumericColumnNames(colunasVisiveis);
	const categoricas = getCategoricalColumnNames(colunasVisiveis);
	const datas = getDateColumnNames(colunasVisiveis);
	const todasColunas = colunasVisiveis.map(c => c.nome);
	const baseCategoricalOrAll = categoricas.length > 0 ? categoricas : todasColunas;
	const cb = onChartConfigChangeCallback;

	switch (chartType) {
		case 'bar':
			setupBarChartControlListeners(dataset, baseCategoricalOrAll, numericas, todasColunas, cb);
			return;
		case 'scatter':
			setupScatterPlotControlListeners(dataset, numericas, todasColunas, cb);
			return;
		case 'pie':
			setupPieChartControlListeners(dataset, baseCategoricalOrAll, numericas, todasColunas, cb);
			return;
		case 'bubble':
			setupBubbleChartControlListeners(dataset, baseCategoricalOrAll, numericas, todasColunas, cb);
			return;
		case 'network':
			setupNetworkGraphControlListeners(dataset, todasColunas, numericas, cb);
			return;
		case 'treemap':
			setupTreeMapControlListeners(dataset, baseCategoricalOrAll, numericas, todasColunas, cb);
			return;
		case 'line':
			setupLineChartControlListeners(dataset, numericas, datas, todasColunas, cb);
	}
}

function handleChartTypeSelect(chartType, dataset) {
	if (chartType === null) {
		setActiveChartType(null);
		onChartConfigChangeCallback?.();
		return;
	}
	const colunasVisiveis = filterVisibleColumns(dataset);
	const numericas = getNumericColumnNames(colunasVisiveis);
	const categoricas = getCategoricalColumnNames(colunasVisiveis);
	const datas = getDateColumnNames(colunasVisiveis);
	const todasColunas = colunasVisiveis.map(c => c.nome);
	const defaults = computeActivationDefaults(chartType, dataset, { numericas, categoricas, todasColunas, datas });
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
