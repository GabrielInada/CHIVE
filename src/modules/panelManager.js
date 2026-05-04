/**
 * CHIVE Panel Manager
 *
 * Orchestrator module that coordinates panel composition:
 * - Adding/removing charts
 * - Managing slots and layouts
 * - Delegating rendering to panelRenderer
 * - Delegating resize to panelResize
 * - Delegating export to panelExporter
 *
 * Security note: Uses textContent for all user-provided names to prevent XSS.
 */

import { t } from '../services/i18nService.js';
import { ok, fail } from '../utils/result.js';
import { mergeChartConfigWithDefaults } from '../config/chartDefaults.js';
import { applyGlobalFilterRules, resolveGlobalFilterForColumns } from '../utils/globalFilter.js';
import { getNumericColumnNames } from '../utils/columnHelpers.js';
import {
	LAYOUTS_PAINEL,
	getLayoutConfig as getPanelLayoutConfig,
} from './panel/layoutConfig.js';
import {
	getPanelBlocks,
	getActiveDataset,
	addChartSnapshot,
	removeChartSnapshot,
	getChartSnapshot,
	setPanelBlockTemplate,
	validatePanelSlots,
	clearPanel,
	onStateChange,
	STATE_EVENTS,
} from './appState.js';
import {
	renderSidebarPanel as renderSidebar,
	renderCanvasPanel as renderCanvas,
	fillLayoutSelect,
} from './panel/panelRenderer.js';
import { exportPanelLayoutSvg as exportSvg } from './panel/panelExporter.js';
import { SUPPORTED_PANEL_CHART_TYPES } from './panel/renderChartFromSpec.js';

// Callback for feedback UI (will be set by main.js)
let feedbackCallback = null;

// Guard: prevents duplicate listener registration if initPanelManager is called more than once
let panelManagerInitialized = false;

/**
 * Initialize panel manager
 * @param {Function} feedbackFn - Optional callback for feedback messages
 */
export function initPanelManager(feedbackFn = null) {
	// Always update the feedback callback — callers may legitimately
	// pass a different function without intending to re-register listeners.
	feedbackCallback = feedbackFn;

	if (panelManagerInitialized) return;
	panelManagerInitialized = true;

	// Re-render when state changes
	onStateChange(STATE_EVENTS.CHART_ADDED, handleChartStateChange);
	onStateChange(STATE_EVENTS.CHART_REMOVED, handleChartStateChange);
	onStateChange(STATE_EVENTS.PANEL_BLOCK_SLOT_ASSIGNED, handleChartStateChange);
	onStateChange(STATE_EVENTS.PANEL_BLOCK_ADDED, handleLayoutChange);
	onStateChange(STATE_EVENTS.PANEL_BLOCK_REMOVED, handleLayoutChange);
	onStateChange(STATE_EVENTS.PANEL_BLOCK_MOVED, handleLayoutChange);
	onStateChange(STATE_EVENTS.PANEL_BLOCK_TEMPLATE_CHANGED, handleLayoutChange);
	onStateChange(STATE_EVENTS.PANEL_BLOCK_PROPORTIONS_UPDATED, handleLayoutChange);
	onStateChange(STATE_EVENTS.PANEL_BLOCK_HEIGHT_UPDATED, handleLayoutChange);
	onStateChange(STATE_EVENTS.PANEL_BLOCK_BORDER_UPDATED, handleLayoutChange);
}

/**
 * Reset initialization state for testing purposes only.
 * Do not call this in production code.
 * @internal
 */
export function _resetPanelManagerForTesting() {
	panelManagerInitialized = false;
}

/**
 * Handle chart state changes - re-render UI
 * @private
 */
function handleChartStateChange() {
	renderSidebarPanel();
	renderCanvasPanel();
}

/**
 * Handle layout changes
 * @private
 */
function handleLayoutChange() {
	validatePanelSlots();
	renderCanvasPanel();
	fillLayoutSelect();
}

/**
 * Add chart snapshot from visualization
 * @param {string} containerId - DOM element ID of chart container
 * @param {string} chartBaseName - Chart display name
 * @returns {Object} { ok: boolean, reason?: string }
 */
export function addChartToPanel(containerId, chartBaseName, metadata = null) {
	try {
		const type = metadata?.type;
		if (!type || !SUPPORTED_PANEL_CHART_TYPES.includes(type)) {
			return fail('unknown-type');
		}

		const dataset = getActiveDataset();
		if (!dataset) return fail('no-dataset');

		const mergedConfig = mergeChartConfigWithDefaults(dataset.configGraficos);
		const allColumnNames = Array.isArray(dataset.colunas)
			? dataset.colunas.map(column => column?.nome).filter(Boolean)
			: [];
		const numericColumnNames = getNumericColumnNames(dataset.colunas || []);
		const safeGlobalFilter = resolveGlobalFilterForColumns(mergedConfig.globalFilter, allColumnNames);
		const filteredRows = applyGlobalFilterRules(dataset.dados || [], safeGlobalFilter, numericColumnNames);

		const chartId = addChartSnapshot({
			nome: chartBaseName,
			type,
			config: structuredClone(mergedConfig[type] || {}),
			dataSnapshot: structuredClone(filteredRows),
			columnsSnapshot: structuredClone(dataset.colunas || []),
			metadata,
			metaSummary: typeof metadata?.summary === 'string' ? metadata.summary : '',
		});

		renderSidebarPanel();
		renderCanvasPanel();
		return ok({ chartId });
	} catch (err) {
		if (feedbackCallback) {
			feedbackCallback(t('chive-panel-add-error'), 'error');
		}
		return fail('add-error');
	}
}

/**
 * Remove chart from panel
 * @param {string} chartId - Chart identifier
 */
export function removeChartFromPanel(chartId) {
	removeChartSnapshot(chartId);
	renderSidebarPanel();
	renderCanvasPanel();
}

/**
 * Get chart snapshot by ID
 * @param {string} chartId - Chart identifier
 * @returns {Object|null} Chart snapshot or null
 */
export function getChartById(chartId) {
	return getChartSnapshot(chartId);
}

/**
 * Get layout configuration by ID
 * @param {string} layoutId - Layout identifier
 * @returns {Object} Layout configuration
 */
export function getLayoutConfig(layoutId) {
	return getPanelLayoutConfig(layoutId);
}

/**
 * Render panel sidebar (list of saved charts)
 */
export function renderSidebarPanel() {
	renderSidebar(removeChartFromPanel);
}

/**
 * Render panel canvas (layout with slots)
 */
export function renderCanvasPanel() {
	renderCanvas(renderCanvasPanel, feedbackCallback);
}

/**
 * Change panel layout and re-render
 * @param {string} layoutId - Layout identifier
 */
export function changeLayout(layoutId) {
	if (!LAYOUTS_PAINEL[layoutId]) {
		return;
	}
	const blocks = getPanelBlocks();
	if (!blocks[0]) return;
	setPanelBlockTemplate(blocks[0].id, layoutId);
}

/**
 * Export panel layout as SVG
 * @returns {Object} { ok: boolean, reason?: string }
 */
export function exportPanelLayoutSvg() {
	return exportSvg(feedbackCallback);
}

/**
 * Setup panel event listeners (layout selector, export button)
 */
export function setupPanelEventListeners() {
	const selectLayout = document.getElementById('select-panel-layout');
	const btnExportar = document.getElementById('btn-exportar-painel');

	if (selectLayout) {
		selectLayout.addEventListener('change', e => {
			changeLayout(e.target.value);
		});
	}

	if (btnExportar) {
		btnExportar.addEventListener('click', () => {
			const result = exportPanelLayoutSvg();
			if (!result.ok) {
				if (feedbackCallback) {
					let msg = t('chive-panel-export-error');
					if (result.reason === 'canvas-not-found') {
						msg = 'Panel canvas not found';
					} else if (result.reason === 'empty-canvas') {
						msg = 'Panel is empty';
					}
					feedbackCallback(msg, 'error');
				}
			} else {
				if (feedbackCallback) {
					feedbackCallback(t('chive-panel-export-svg'), 'success');
				}
			}
		});
	}

}

/**
 * Initialize layout selector dropdown
 */
export function initializeLayoutSelector() {
	fillLayoutSelect();
}

/**
 * Clear all panel data
 */
export function clearPanelData() {
	clearPanel();
	renderSidebarPanel();
	renderCanvasPanel();
}
