/**
 * CHIVE Chart Controls Manager.
 *
 * Owns visualization controls in the sidebar:
 *   - Chart-type list (top pane), radio selection of the active chart.
 *   - Params pane (bottom), controls for the currently active chart.
 *   - Centralized activation defaults (column selection on chart switch).
 *
 * Each chart type has its own controls module (`barControls.js`,
 * `pieControls.js`, …) that owns the chart-specific logic. This module
 * wires them together via {@link CHART_CONTROL_REGISTRY} and renders
 * the sidebar shell.
 *
 * Sidebar scroll-position preservation deserves a note: re-rendering
 * replaces the entire params DOM, so on every render we capture an
 * "anchor" (either a recently-interacted target or the focused element)
 * and restore the scroll position after the render so the user does not
 * lose their place when the active chart's config changes.
 *
 * @typedef {import('../../types.js').Dataset} Dataset
 * @typedef {import('../../types.js').ChartTypeKey} ChartTypeKey
 */

import { t } from '../../services/i18nService.js';
import {
	filterVisibleColumns,
	getNumericColumnNames,
	getCategoricalColumnNames,
	getDateColumnNames,
} from '../../utils/columnHelpers.js';
import { mergeChartConfigWithDefaults } from '../../config/chartDefaults.js';
import { setActiveChartType } from '../state/appState.js';
import { createBarChartControls, setupBarChartControlListeners, computeDefaults as computeBarDefaults } from './barControls.js';
import { createBubbleChartControls, setupBubbleChartControlListeners, computeDefaults as computeBubbleDefaults } from './bubbleControls.js';
import { createLineChartControls, setupLineChartControlListeners, computeDefaults as computeLineDefaults } from './lineControls.js';
import { createNetworkGraphControls, setupNetworkGraphControlListeners, computeDefaults as computeNetworkDefaults } from './networkControls.js';
import { createScatterPlotControls, setupScatterPlotControlListeners, computeDefaults as computeScatterDefaults } from './scatterControls.js';
import { createPieChartControls, setupPieChartControlListeners, computeDefaults as computePieDefaults } from './pieControls.js';
import { createTreeMapControls, setupTreeMapControlListeners, computeDefaults as computeTreemapDefaults } from './treemapControls.js';
import { createTinControls, setupTinControlListeners, computeDefaults as computeTinDefaults } from './tinControls.js';
import { CHART_TYPES } from './chartTypes.js';
import { renderChartParamsDOM } from '../../components/results/chartParamsView.js';
import { openChartTypePickerDialog } from '../../components/results/chartTypePickerDialog.js';

import { setLiveRenderCallback } from './livePreview.js';
import { ensureChartHeightResizeHandles } from './chartHeightResize.js';

let onChartConfigChangeCallback = null;
const trackedSidebarContainers = new WeakSet();
let lastSidebarInteractionAnchor = null;
// WHY: 2s is the window during which a recent change/input/click counts as
// "the user is actively editing this element". Inside the window we anchor scroll
// to the touched element instead of `document.activeElement`, which handles cases
// where the interaction shifts focus away (e.g. dropdown closes after a select).
const SIDEBAR_INTERACTION_MAX_AGE_MS = 2000;

/**
 * Initialize the chartControls module. Stores the config-change callback
 * (invoked after every user mutation that should trigger a refresh) and
 * forwards the live-render callback to the {@link livePreview} stub.
 *
 * @param {(() => void) | null} [configChangeCallback=null]
 * @param {(() => void) | null} [liveRenderCallback=null]
 */
export function initChartControls(configChangeCallback = null, liveRenderCallback = null) {
	onChartConfigChangeCallback = configChangeCallback;
	setLiveRenderCallback(liveRenderCallback);
}

/**
 * Snapshot which collapsible sections are currently expanded in the
 * params pane so the next render can restore them.
 *
 * @private
 */
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

/**
 * Restore the per-section expanded state captured by
 * {@link captureControlSectionExpansionState}.
 *
 * @private
 */
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

/**
 * Attach the interaction-tracking listeners once per container. The
 * `change`/`input`/`click` listeners stash the most-recently-touched
 * element (id + bounding rect top) into module state for the next
 * scroll-anchor computation.
 *
 * @private
 */
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

/**
 * Pick the best scroll-restoration anchor for the next render. Prefers
 * a recently-touched element (within `SIDEBAR_INTERACTION_MAX_AGE_MS`)
 * over `document.activeElement`; falls back to a plain scrollTop carry-
 * over when no anchor is available.
 *
 * @private
 */
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

/**
 * Restore scroll position after a re-render. When the captured anchor's
 * element is still in the DOM, scroll to keep that element at the same
 * viewport offset; otherwise fall back to the previous scrollTop.
 *
 * Side effect: refocuses the recovered anchor element to preserve the
 * user's editing context. `preventScroll: true` avoids double-scroll.
 *
 * @private
 */
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

/**
 * Derive the column buckets each per-chart controls file needs. Computed
 * once per call site so the registry entries below stay small.
 *
 * @private
 * @param {Dataset} dataset
 * @returns {{ numeric: string[], categorical: string[], dates: string[], allColumns: string[], baseCategoricalOrAll: string[] }} `baseCategoricalOrAll` falls back to all columns when no categoricals exist.
 */
function getColumnContext(dataset) {
	const visibleColumns = filterVisibleColumns(dataset);
	const numeric = getNumericColumnNames(visibleColumns);
	const categorical = getCategoricalColumnNames(visibleColumns);
	const dates = getDateColumnNames(visibleColumns);
	const allColumns = visibleColumns.map(c => c.name);
	const baseCategoricalOrAll = categorical.length > 0 ? categorical : allColumns;
	return { numeric, categorical, dates, allColumns, baseCategoricalOrAll };
}

/**
 * Per-chart wiring table. Adapts the unified `(dataset, ctx, cb?)`
 * signature used by the orchestrator to each per-chart file's factory
 * signature. The per-chart files own the chart-specific logic; this
 * table is pure wiring.
 *
 * Entries:
 * - `build(ds, ctx)`              → constructs DOM control elements.
 * - `attachListeners(ds, ctx, cb)`→ wires listeners after the DOM is mounted.
 * - `computeDefaults(ds, ctx)`    → returns initial config for first activation.
 *
 * @private
 */
const CHART_CONTROL_REGISTRY = {
	bar: {
		build: (ds, ctx) => createBarChartControls(ds, ctx.baseCategoricalOrAll, ctx.numeric, ctx.allColumns),
		attachListeners: (ds, ctx, cb) => setupBarChartControlListeners(ds, ctx.baseCategoricalOrAll, ctx.numeric, ctx.allColumns, cb),
		computeDefaults: computeBarDefaults,
	},
	scatter: {
		build: (ds, ctx) => createScatterPlotControls(ds, ctx.numeric, ctx.allColumns),
		attachListeners: (ds, ctx, cb) => setupScatterPlotControlListeners(ds, ctx.numeric, ctx.allColumns, cb),
		computeDefaults: computeScatterDefaults,
	},
	pie: {
		build: (ds, ctx) => createPieChartControls(ds, ctx.baseCategoricalOrAll, ctx.numeric, ctx.allColumns),
		attachListeners: (ds, ctx, cb) => setupPieChartControlListeners(ds, ctx.baseCategoricalOrAll, ctx.numeric, ctx.allColumns, cb),
		computeDefaults: computePieDefaults,
	},
	bubble: {
		build: (ds, ctx) => createBubbleChartControls(ds, ctx.baseCategoricalOrAll, ctx.numeric, ctx.allColumns),
		attachListeners: (ds, ctx, cb) => setupBubbleChartControlListeners(ds, ctx.baseCategoricalOrAll, ctx.numeric, ctx.allColumns, cb),
		computeDefaults: computeBubbleDefaults,
	},
	network: {
		build: (ds, ctx) => createNetworkGraphControls(ds, ctx.allColumns, ctx.numeric, ctx.categorical),
		attachListeners: (ds, ctx, cb) => setupNetworkGraphControlListeners(ds, ctx.allColumns, ctx.numeric, cb),
		computeDefaults: computeNetworkDefaults,
	},
	treemap: {
		build: (ds, ctx) => createTreeMapControls(ds, ctx.baseCategoricalOrAll, ctx.numeric, ctx.allColumns),
		attachListeners: (ds, ctx, cb) => setupTreeMapControlListeners(ds, ctx.baseCategoricalOrAll, ctx.numeric, ctx.allColumns, cb),
		computeDefaults: computeTreemapDefaults,
	},
	line: {
		build: (ds, ctx) => createLineChartControls(ds, ctx.numeric, ctx.dates, ctx.allColumns),
		attachListeners: (ds, ctx, cb) => setupLineChartControlListeners(ds, ctx.numeric, ctx.dates, ctx.allColumns, cb),
		computeDefaults: computeLineDefaults,
	},
	tin: {
		build: (ds, ctx) => createTinControls(ds, ctx.numeric, ctx.allColumns),
		attachListeners: (ds, ctx, cb) => setupTinControlListeners(ds, ctx.numeric, ctx.allColumns, cb),
		computeDefaults: computeTinDefaults,
	},
};

/**
 * Resolve first-time activation defaults for `chartType`. The active
 * chart's existing config wins when still valid; falls back to the first
 * available column otherwise.
 *
 * Test-entry shape: accepts a pre-built column context so tests can drive
 * the logic without bootstrapping a full sidebar render.
 *
 * @param {ChartTypeKey} chartType
 * @param {Dataset} dataset
 * @param {{ numeric: string[], categorical: string[], allColumns: string[], dates?: string[] }} columnContext
 * @returns {Object} Partial chart-type config; empty when the type is unknown.
 */
function computeActivationDefaults(chartType, dataset, { numeric, categorical, allColumns, dates = [] }) {
	const entry = CHART_CONTROL_REGISTRY[chartType];
	if (!entry) return {};
	const baseCategoricalOrAll = categorical.length > 0 ? categorical : allColumns;
	return entry.computeDefaults(dataset, { numeric, categorical, allColumns, dates, baseCategoricalOrAll });
}

/** @private */
function buildControlsForChart(chartType, dataset) {
	const entry = CHART_CONTROL_REGISTRY[chartType];
	if (!entry) return [];
	return entry.build(dataset, getColumnContext(dataset));
}

/** @private */
function setupListenersForChart(chartType, dataset) {
	const entry = CHART_CONTROL_REGISTRY[chartType];
	if (!entry) return;
	entry.attachListeners(dataset, getColumnContext(dataset), onChartConfigChangeCallback);
}

/**
 * Handle a user picking a chart type (or clearing the active selection).
 * Resolves the appropriate activation defaults, writes them to state via
 * `setActiveChartType`, and fires the config-change callback.
 *
 * @private
 * @param {ChartTypeKey | null} chartType - `null` clears the active chart.
 * @param {Dataset} dataset
 */
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

/**
 * Exported for tests so the activation-defaults logic can be exercised
 * without bootstrapping a full sidebar render.
 *
 * @internal
 */
export { computeActivationDefaults, handleChartTypeSelect };

/**
 * Open the chart-type picker dialog and route the result back into
 * {@link handleChartTypeSelect}. `null` result (user cancelled) is a
 * no-op.
 *
 * @private
 */
function openPickerForDataset(activeChartType, dataset) {
	openChartTypePickerDialog({ activeChartType, translate: t }).then(result => {
		if (result === null) return;
		handleChartTypeSelect(result.chartType, dataset);
	});
}

/**
 * Re-render the params pane of the sidebar for the given dataset. Called
 * by `main.js` after every state change that could affect sidebar
 * contents.
 *
 * Renders:
 *   - Empty state if no dataset or no visible columns.
 *   - Otherwise the active chart's controls, computed via the registry.
 *
 * Preserves expansion state of collapsible sections and scroll position
 * across re-renders.
 *
 * @param {Dataset | null | undefined} dataset
 */
export function renderChartControlsSidebar(dataset) {
	const paramsContainer = document.getElementById('viz-chart-params');
	if (!paramsContainer) return;

	// Runs here (not in chartsView) because the handles write chart config
	// and this render fires on boot, config changes, and locale changes.
	ensureChartHeightResizeHandles();
	ensureSidebarInteractionTracking(paramsContainer);
	const scrollAnchor = getSidebarScrollAnchor(paramsContainer);
	const controlSectionState = captureControlSectionExpansionState(paramsContainer);

	const emptyState = (message) => {
		paramsContainer.replaceChildren();
		const emptyDiv = document.createElement('div');
		emptyDiv.className = 'table-no-columns';
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

	const config = mergeChartConfigWithDefaults(dataset.chartConfig);
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
