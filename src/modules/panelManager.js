/**
 * CHIVE Panel Manager
 * 
 * Handles all panel composition logic:
 * - Adding/removing charts
 * - Managing slots and layouts
 * - Rendering sidebar and canvas
 * - SVG export of composed layouts
 * 
 * Security note: Uses textContent for all user-provided names to prevent XSS.
 */

import { t } from '../services/i18nService.js';
import { escaparHTML } from '../utils/formatters.js';
import { capturarSvgMarkupDeContainer, baixarSvgMarkup } from '../utils/svgExport.js';
import {
	getPanelCharts,
	getPanelSlots,
	getPanelLayout,
	addChartSnapshot,
	removeChartSnapshot,
	getChartSnapshot,
	assignChartToSlot,
	setPanelLayout,
	validatePanelSlots,
	clearPanel,
	onStateChange,
} from './appState.js';

const LAYOUTS_PAINEL = {
	'layout-single': {
		classe: 'layout-single',
		slots: ['slot-1'],
		labelKey: 'chive-panel-layout-single',
	},
	'layout-2col': {
		classe: 'layout-2col',
		slots: ['slot-1', 'slot-2'],
		labelKey: 'chive-panel-layout-2col',
	},
	'layout-hero2': {
		classe: 'layout-hero2',
		slots: ['slot-1', 'slot-2', 'slot-3'],
		labelKey: 'chive-panel-layout-hero2',
	},
};

// Callback for feedback UI (will be set by main.js)
let feedbackCallback = null;

/**
 * Initialize panel manager
 * @param {Function} feedbackFn - Optional callback for feedback messages
 */
export function initPanelManager(feedbackFn = null) {
	feedbackCallback = feedbackFn;
	
	// Re-render when state changes
	onStateChange('chartAdded', handleChartStateChange);
	onStateChange('chartRemoved', handleChartStateChange);
	onStateChange('slotAssigned', handleChartStateChange);
	onStateChange('layoutChanged', handleLayoutChange);
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
	cleanupInvalidSlots();
	renderCanvasPanel();
	fillLayoutSelect();
}

/**
 * Add chart snapshot from visualization
 * @param {string} containerId - DOM element ID of chart container
 * @param {string} chartBaseName - Chart display name
 * @returns {Object} { ok: boolean, reason?: string }
 */
export function addChartToPanel(containerId, chartBaseName) {
	try {
		const captured = capturarSvgMarkupDeContainer(containerId);
		if (!captured.ok) {
			return captured;
		}

		const chartId = addChartSnapshot({
			nome: chartBaseName,
			svgMarkup: captured.svgMarkup,
		});

		renderSidebarPanel();
		renderCanvasPanel();
		return { ok: true, chartId };
	} catch (err) {
		if (feedbackCallback) {
			feedbackCallback(t('chive-panel-add-error'), 'error');
		}
		return { ok: false, reason: 'add-error' };
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
	return LAYOUTS_PAINEL[layoutId] || LAYOUTS_PAINEL['layout-2col'];
}

/**
 * Get current layout configuration
 * @returns {Object} Current layout configuration
 */
function getCurrentLayout() {
	return getLayoutConfig(getPanelLayout());
}

/**
 * Cleanup invalid slot assignments
 * Removes slots/assignments that don't match current layout or missing charts
 * @private
 */
function cleanupInvalidSlots() {
	validatePanelSlots();
	const layout = getCurrentLayout();
	const slots = getPanelSlots();
	
	// Remove slots not in current layout
	Object.keys(slots).forEach(slotId => {
		if (!layout.slots.includes(slotId)) {
			assignChartToSlot(slotId, null);
		}
	});
}

/**
 * Render panel sidebar (list of saved charts)
 * Uses textContent for chart names (XSS prevention)
 * @private
 */
export function renderSidebarPanel() {
	const lista = document.getElementById('lista-painel-charts');
	if (!lista) return;

	const charts = getPanelCharts();
	if (charts.length === 0) {
		lista.innerHTML = '';
		const emptyDiv = document.createElement('div');
		emptyDiv.className = 'painel-vazio';
		emptyDiv.textContent = t('chive-panel-empty-sidebar');
		lista.appendChild(emptyDiv);
		return;
	}

	const desktopDnd = window.matchMedia('(min-width: 901px)').matches;
	lista.innerHTML = '';

	charts.forEach(chart => {
		const article = document.createElement('article');
		article.className = 'panel-item';
		article.draggable = desktopDnd;
		article.dataset.panelChartId = chart.id;

		// Top section with title and remove button
		const topo = document.createElement('div');
		topo.className = 'panel-item-topo';

		const titulo = document.createElement('span');
		titulo.className = 'panel-item-titulo';
		titulo.textContent = chart.nome; // textContent for XSS prevention
		titulo.title = chart.nome;

		const removeBtn = document.createElement('button');
		removeBtn.className = 'panel-item-remover';
		removeBtn.type = 'button';
		removeBtn.dataset.removePanelChart = chart.id;
		removeBtn.setAttribute('aria-label', t('chive-panel-remove-chart'));
		removeBtn.textContent = '×';

		topo.appendChild(titulo);
		topo.appendChild(removeBtn);

		// Preview section (SVG content)
		const preview = document.createElement('div');
		preview.className = 'panel-item-preview';
		preview.innerHTML = chart.svgMarkup;

		article.appendChild(topo);
		article.appendChild(preview);
		lista.appendChild(article);

		// Drag event
		if (desktopDnd) {
			article.addEventListener('dragstart', e => {
				e.dataTransfer.effectAllowed = 'copy';
				e.dataTransfer.setData('text/panel-chart-id', chart.id);
			});
		}

		// Remove button click
		removeBtn.addEventListener('click', e => {
			e.stopPropagation();
			removeChartFromPanel(chart.id);
		});
	});
}

/**
 * Render panel canvas (layout with slots)
 * Uses textContent for UI text, innerHTML only for trusted SVG content
 * @private
 */
export function renderCanvasPanel() {
	cleanupInvalidSlots();
	const canvas = document.getElementById('panel-layout-canvas');
	if (!canvas) return;

	const layout = getCurrentLayout();
	const slots = getPanelSlots();
	const desktopDnd = window.matchMedia('(min-width: 901px)').matches;

	canvas.innerHTML = '';
	const gridDiv = document.createElement('div');
	gridDiv.id = 'painel-layout-grid';
	gridDiv.className = `painel-layout ${layout.classe}`;

	// Create slot elements
	layout.slots.forEach(slotId => {
		const chart = getChartSnapshot(slots[slotId]);
		const slot = document.createElement('div');
		slot.className = chart ? 'painel-slot' : 'painel-slot vazio';
		slot.dataset.panelSlot = slotId;

		if (chart) {
			slot.dataset.panelChartId = chart.id;
			slot.draggable = desktopDnd;

			// Clear button
			const clearBtn = document.createElement('button');
			clearBtn.type = 'button';
			clearBtn.className = 'painel-slot-limpar';
			clearBtn.dataset.clearPanelSlot = slotId;
			clearBtn.setAttribute('aria-label', t('chive-panel-clear-slot'));
			clearBtn.textContent = '×';
			clearBtn.addEventListener('click', () => {
				assignChartToSlot(slotId, null);
			});

			// SVG content
			const svgDiv = document.createElement('div');
			svgDiv.className = 'painel-slot-svg';
			svgDiv.innerHTML = chart.svgMarkup;

			slot.appendChild(clearBtn);
			slot.appendChild(svgDiv);

			// Drag start for slot-to-slot
			if (desktopDnd) {
				slot.addEventListener('dragstart', e => {
					e.dataTransfer.effectAllowed = 'move';
					e.dataTransfer.setData('text/panel-chart-id', chart.id);
					e.dataTransfer.setData('text/panel-slot-id', slotId);
				});
			}
		} else {
			// Empty slot
			const placeholder = document.createElement('div');
			placeholder.className = 'painel-slot-placeholder';
			placeholder.textContent = t('chive-panel-slot-empty');
			slot.appendChild(placeholder);
		}

		gridDiv.appendChild(slot);
	});

	canvas.appendChild(gridDiv);

	// Setup drag-drop handlers for all slots
	canvas.querySelectorAll('[data-panel-slot]').forEach(slot => {
		if (desktopDnd) {
			slot.addEventListener('dragover', e => {
				e.preventDefault();
				slot.classList.add('drag-over');
			});

			slot.addEventListener('dragleave', () => {
				slot.classList.remove('drag-over');
			});

			slot.addEventListener('drop', e => {
				e.preventDefault();
				slot.classList.remove('drag-over');

				const targetSlotId = slot.dataset.panelSlot;
				const sourceSlotId = e.dataTransfer.getData('text/panel-slot-id');
				const chartId = e.dataTransfer.getData('text/panel-chart-id');

				if (!chartId || !getChartSnapshot(chartId)) return;

				if (sourceSlotId) {
					// Slot-to-slot: move or swap
					if (sourceSlotId === targetSlotId) return;

					const slots = getPanelSlots();
					const targetChartId = slots[targetSlotId];
					const hasTargetChart = targetChartId !== undefined && targetChartId !== null;

					assignChartToSlot(targetSlotId, chartId);
					if (hasTargetChart) {
						assignChartToSlot(sourceSlotId, targetChartId);
					} else {
						assignChartToSlot(sourceSlotId, null);
					}
				} else {
					// Sidebar-to-slot: copy
					assignChartToSlot(targetSlotId, chartId);
				}

				renderCanvasPanel();
			});
		}
	});
}

/**
 * Fill layout selector dropdown
 * @private
 */
function fillLayoutSelect() {
	const select = document.getElementById('select-panel-layout');
	if (!select) return;

	const currentLayout = getPanelLayout();
	select.innerHTML = '';

	Object.entries(LAYOUTS_PAINEL).forEach(([id, layout]) => {
		const option = document.createElement('option');
		option.value = id;
		option.textContent = t(layout.labelKey);
		option.selected = id === currentLayout;
		select.appendChild(option);
	});
}

/**
 * Change panel layout and re-render
 * @param {string} layoutId - Layout identifier
 */
export function changeLayout(layoutId) {
	if (!LAYOUTS_PAINEL[layoutId]) {
		return;
	}
	setPanelLayout(layoutId);
}

/**
 * Export panel layout as SVG
 * Composites all filled slots into a single SVG file
 * @returns {Object} { ok: boolean, reason?: string }
 */
export function exportPanelLayoutSvg() {
	const canvas = document.getElementById('panel-layout-canvas');
	if (!canvas) {
		return { ok: false, reason: 'canvas-not-found' };
	}

	const rectCanvas = canvas.getBoundingClientRect();
	if (rectCanvas.width <= 0 || rectCanvas.height <= 0) {
		return { ok: false, reason: 'empty-canvas' };
	}

	try {
		const parser = new DOMParser();
		const serializer = new XMLSerializer();
		const docSvg = document.implementation.createDocument(
			'http://www.w3.org/2000/svg',
			'svg',
			null
		);
		const svgRoot = docSvg.documentElement;

		svgRoot.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
		svgRoot.setAttribute('width', String(Math.round(rectCanvas.width)));
		svgRoot.setAttribute('height', String(Math.round(rectCanvas.height)));
		svgRoot.setAttribute(
			'viewBox',
			`0 0 ${Math.round(rectCanvas.width)} ${Math.round(rectCanvas.height)}`
		);

		// Add background
		const bg = docSvg.createElementNS('http://www.w3.org/2000/svg', 'rect');
		bg.setAttribute('x', '0');
		bg.setAttribute('y', '0');
		bg.setAttribute('width', '100%');
		bg.setAttribute('height', '100%');
		bg.setAttribute('fill', '#fbfaf6');
		svgRoot.appendChild(bg);

		const slots = getPanelSlots();
		const layout = getCurrentLayout();

		// Add each chart in its slot
		layout.slots.forEach(slotId => {
			const chart = getChartSnapshot(slots[slotId]);
			if (!chart) return;

			const slotEl = canvas.querySelector(`[data-panel-slot="${slotId}"]`);
			if (!slotEl) return;

			const slotRect = slotEl.getBoundingClientRect();
			const x = slotRect.left - rectCanvas.left;
			const y = slotRect.top - rectCanvas.top;
			const w = slotRect.width;
			const h = slotRect.height;

			const parsed = parser.parseFromString(chart.svgMarkup, 'image/svg+xml');
			const chartSvg = parsed.documentElement;

			chartSvg.setAttribute('x', String(x));
			chartSvg.setAttribute('y', String(y));
			chartSvg.setAttribute('width', String(w));
			chartSvg.setAttribute('height', String(h));

			if (!chartSvg.getAttribute('preserveAspectRatio')) {
				chartSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
			}

			svgRoot.appendChild(docSvg.importNode(chartSvg, true));
		});

		const svgString = serializer.serializeToString(svgRoot);
		return baixarSvgMarkup(svgString, 'panel-layout');
	} catch (err) {
		if (feedbackCallback) {
			feedbackCallback(t('chive-panel-export-error'), 'error');
		}
		return { ok: false, reason: 'export-error' };
	}
}

/**
 * Setup panel event listeners (layout selector, export button)
 * Called by main.js or event handlers module
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
 * Called after DOM is ready
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
