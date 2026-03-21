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
import { capturarSvgMarkupDeContainer, baixarSvgMarkup } from '../utils/svgExport.js';
import {
	getPanelCharts,
	getPanelBlocks,
	addChartSnapshot,
	removeChartSnapshot,
	getChartSnapshot,
	assignChartToPanelBlockSlot,
	setPanelBlockTemplate,
	addPanelBlock,
	removePanelBlock,
	movePanelBlock,
	updatePanelBlockProportions,
	updatePanelBlockHeight,
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
	'layout-3col': {
		classe: 'layout-3col',
		slots: ['slot-1', 'slot-2', 'slot-3'],
		labelKey: 'chive-panel-layout-3col',
	},
	'layout-1x2': {
		classe: 'layout-1x2',
		slots: ['slot-1', 'slot-2'],
		labelKey: 'chive-panel-layout-1x2',
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
	onStateChange('panelBlockSlotAssigned', handleChartStateChange);
	onStateChange('panelBlockAdded', handleLayoutChange);
	onStateChange('panelBlockRemoved', handleLayoutChange);
	onStateChange('panelBlockMoved', handleLayoutChange);
	onStateChange('panelBlockTemplateChanged', handleLayoutChange);
	onStateChange('panelBlockProportionsUpdated', handleLayoutChange);
	onStateChange('panelBlockHeightUpdated', handleLayoutChange);
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
function getTemplateForBlock(block) {
	return getLayoutConfig(block?.templateId);
}

function clampPercent(value, min = 20, max = 80) {
	const n = Number(value);
	if (!Number.isFinite(n)) return min;
	return Math.max(min, Math.min(max, n));
}

/**
 * Cleanup invalid slot assignments
 * Removes slots/assignments that don't match current layout or missing charts
 * @private
 */
function cleanupInvalidSlots() {
	validatePanelSlots();
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
	const blocks = getPanelBlocks();
	const desktopDnd = window.matchMedia('(min-width: 901px)').matches;

	canvas.innerHTML = '';

	const stack = document.createElement('div');
	stack.className = 'painel-block-stack';

	blocks.forEach((block, index) => {
		const layout = getTemplateForBlock(block);
		const blockEl = document.createElement('section');
		blockEl.className = 'painel-block';
		blockEl.dataset.panelBlockId = block.id;

		const header = document.createElement('div');
		header.className = 'painel-block-header';

		const title = document.createElement('span');
		title.className = 'painel-block-title';
		title.textContent = `Block ${index + 1}`;

		const actions = document.createElement('div');
		actions.className = 'painel-block-actions';

		const upBtn = document.createElement('button');
		upBtn.type = 'button';
		upBtn.className = 'painel-block-btn';
		upBtn.dataset.panelBlockUp = block.id;
		upBtn.textContent = '↑';
		upBtn.disabled = index === 0;
		upBtn.addEventListener('click', () => {
			movePanelBlock(block.id, index - 1);
		});

		const downBtn = document.createElement('button');
		downBtn.type = 'button';
		downBtn.className = 'painel-block-btn';
		downBtn.dataset.panelBlockDown = block.id;
		downBtn.textContent = '↓';
		downBtn.disabled = index === blocks.length - 1;
		downBtn.addEventListener('click', () => {
			movePanelBlock(block.id, index + 1);
		});

		const removeBtn = document.createElement('button');
		removeBtn.type = 'button';
		removeBtn.className = 'painel-block-btn painel-block-btn-danger';
		removeBtn.dataset.panelBlockRemove = block.id;
		removeBtn.textContent = '×';
		removeBtn.disabled = blocks.length <= 1;
		removeBtn.addEventListener('click', () => {
			removePanelBlock(block.id);
		});

		actions.appendChild(upBtn);
		actions.appendChild(downBtn);
		actions.appendChild(removeBtn);
		header.appendChild(title);
		header.appendChild(actions);

		const templateSelect = document.createElement('select');
		templateSelect.className = 'painel-block-template';
		templateSelect.dataset.panelBlockTemplate = block.id;
		Object.entries(LAYOUTS_PAINEL).forEach(([id, config]) => {
			const option = document.createElement('option');
			option.value = id;
			option.textContent = t(config.labelKey);
			option.selected = id === block.templateId;
			templateSelect.appendChild(option);
		});
		templateSelect.addEventListener('change', e => {
			setPanelBlockTemplate(block.id, e.target.value);
			fillLayoutSelect();
			renderCanvasPanel();
		});

		const gridDiv = document.createElement('div');
		gridDiv.className = `painel-layout ${layout.classe}`;
		gridDiv.dataset.panelLayoutBlock = block.id;
		applyBlockProportions(gridDiv, block);
		renderGuidedResizeHandles(gridDiv, block);

		layout.slots.forEach(slotId => {
			const chart = getChartSnapshot(block.slots?.[slotId]);
			const slot = document.createElement('div');
			slot.className = chart ? 'painel-slot' : 'painel-slot vazio';
			slot.dataset.panelSlot = slotId;
			slot.dataset.panelBlockId = block.id;

			if (chart) {
				slot.dataset.panelChartId = chart.id;
				slot.draggable = desktopDnd;

				const clearBtn = document.createElement('button');
				clearBtn.type = 'button';
				clearBtn.className = 'painel-slot-limpar';
				clearBtn.dataset.clearPanelSlot = `${block.id}:${slotId}`;
				clearBtn.setAttribute('aria-label', t('chive-panel-clear-slot'));
				clearBtn.textContent = '×';
				clearBtn.addEventListener('click', () => {
					assignChartToPanelBlockSlot(block.id, slotId, null);
					renderCanvasPanel();
				});

				const svgDiv = document.createElement('div');
				svgDiv.className = 'painel-slot-svg';
				svgDiv.innerHTML = chart.svgMarkup;

				slot.appendChild(clearBtn);
				slot.appendChild(svgDiv);

				if (desktopDnd) {
					slot.addEventListener('dragstart', e => {
						e.dataTransfer.effectAllowed = 'move';
						e.dataTransfer.setData('text/panel-chart-id', String(chart.id));
						e.dataTransfer.setData('text/panel-slot-id', slotId);
						e.dataTransfer.setData('text/panel-block-id', block.id);
					});
				}
			} else {
				const placeholder = document.createElement('div');
				placeholder.className = 'painel-slot-placeholder';
				placeholder.textContent = t('chive-panel-slot-empty');
				slot.appendChild(placeholder);
			}

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

					const targetSlotId = slotId;
					const targetBlockId = block.id;
					const sourceSlotId = e.dataTransfer.getData('text/panel-slot-id');
					const sourceBlockId = e.dataTransfer.getData('text/panel-block-id');
					const chartId = e.dataTransfer.getData('text/panel-chart-id');

					if (!chartId || !getChartSnapshot(chartId)) return;

					if (sourceSlotId && sourceBlockId) {
						if (sourceSlotId === targetSlotId && sourceBlockId === targetBlockId) return;

						const stateBlocks = getPanelBlocks();
						const targetBlock = stateBlocks.find(item => item.id === targetBlockId);
						const targetChartId = targetBlock?.slots?.[targetSlotId] ?? null;

						assignChartToPanelBlockSlot(targetBlockId, targetSlotId, chartId);
						if (targetChartId !== null && targetChartId !== undefined) {
							assignChartToPanelBlockSlot(sourceBlockId, sourceSlotId, targetChartId);
						} else {
							assignChartToPanelBlockSlot(sourceBlockId, sourceSlotId, null);
						}
					} else {
						assignChartToPanelBlockSlot(targetBlockId, targetSlotId, chartId);
					}

					renderCanvasPanel();
				});
			}

			gridDiv.appendChild(slot);
		});

		blockEl.appendChild(header);
		blockEl.appendChild(templateSelect);
		blockEl.appendChild(gridDiv);

		const blockResizeHandle = document.createElement('button');
		blockResizeHandle.type = 'button';
		blockResizeHandle.className = 'painel-block-size-handle';
		blockResizeHandle.dataset.panelBlockResize = block.id;
		blockResizeHandle.setAttribute('aria-label', t('chive-panel-resize-block-height'));
		blockResizeHandle.addEventListener('mousedown', event => {
			event.preventDefault();
			startBlockHeightResizeDrag(block.id, gridDiv, event.clientY);
		});

		blockEl.appendChild(blockResizeHandle);
		stack.appendChild(blockEl);
	});

	const addBlockButton = document.createElement('button');
	addBlockButton.type = 'button';
	addBlockButton.className = 'btn-primario painel-add-block-btn';
	addBlockButton.dataset.panelAddBlock = '1';
	addBlockButton.textContent = t('chive-panel-add-block');
	addBlockButton.addEventListener('click', () => {
		const select = document.getElementById('select-panel-layout');
		const templateId = select?.value || 'layout-2col';
		const newBlockId = addPanelBlock(templateId);
		if (newBlockId === null && feedbackCallback) {
			feedbackCallback(t('chive-panel-max-blocks'), 'error');
		}
	});

	canvas.appendChild(stack);
	canvas.appendChild(addBlockButton);
}

function applyBlockProportions(gridDiv, block) {
	if (!block?.proportions) return;
	Object.entries(block.proportions).forEach(([key, value]) => {
		gridDiv.style.setProperty(`--${key}`, `${value}%`);
	});
	applyDynamicBlockHeight(gridDiv, block);
}

function applyDynamicBlockHeight(gridDiv, block) {
	const BASE_MIN_HEIGHT = 220;
	const MAX_MIN_HEIGHT = 620;
	const SLOT_MIN_HEIGHT = 96;
	const ROW_GAP = 10;

	let dynamicMinHeight = BASE_MIN_HEIGHT;

	if (block.templateId === 'layout-1x2') {
		const split = clampPercent(block.proportions?.split ?? 50, 20, 80) / 100;
		const smallestRow = Math.min(split, 1 - split);
		dynamicMinHeight = ROW_GAP + SLOT_MIN_HEIGHT / Math.max(smallestRow, 0.01);
	} else if (block.templateId === 'layout-hero2') {
		const splitRight = clampPercent(block.proportions?.splitRight ?? 50, 20, 80) / 100;
		const smallestRow = Math.min(splitRight, 1 - splitRight);
		dynamicMinHeight = ROW_GAP + SLOT_MIN_HEIGHT / Math.max(smallestRow, 0.01);
	}

	const userHeight = Number(block.heightPx);
	const userBounded = Number.isFinite(userHeight)
		? Math.max(BASE_MIN_HEIGHT, Math.min(userHeight, 760))
		: BASE_MIN_HEIGHT;
	const bounded = Math.max(userBounded, Math.max(BASE_MIN_HEIGHT, Math.min(dynamicMinHeight, MAX_MIN_HEIGHT)));
	gridDiv.style.minHeight = `${Math.round(bounded)}px`;
}

function renderGuidedResizeHandles(gridDiv, block) {
	if (!gridDiv || !block?.proportions) return;

	const handles = [];
	if (block.templateId === 'layout-2col') {
		handles.push({ key: 'split', axis: 'x', position: block.proportions.split ?? 50 });
	} else if (block.templateId === 'layout-1x2') {
		handles.push({ key: 'split', axis: 'y', position: block.proportions.split ?? 50, railStart: 0, railEnd: 100 });
	} else if (block.templateId === 'layout-hero2') {
		const splitMain = clampPercent(block.proportions.splitMain ?? 60, 20, 80);
		handles.push({ key: 'splitMain', axis: 'x', position: splitMain });
		handles.push({
			key: 'splitRight',
			axis: 'y',
			position: block.proportions.splitRight ?? 50,
			railStart: splitMain,
			railEnd: 100,
		});
	} else if (block.templateId === 'layout-3col') {
		const a = Number(block.proportions.a ?? 33);
		const b = Number(block.proportions.b ?? 33);
		handles.push({ key: 'a', axis: 'x', position: a });
		handles.push({ key: 'ab', axis: 'x', position: a + b });
	}

	handles.forEach(handleConfig => {
		let railCenter = null;
		let railSpan = null;

		if (handleConfig.axis === 'y') {
			const railStart = Number(handleConfig.railStart ?? 0);
			const railEnd = Number(handleConfig.railEnd ?? 100);
			railSpan = Math.max(0, railEnd - railStart);
			railCenter = railStart + railSpan / 2;

			const rail = document.createElement('div');
			rail.className = 'painel-resize-rail eixo-y';
			rail.style.left = `${railCenter}%`;
			rail.style.width = `calc(${railSpan}% - 10px)`;
			gridDiv.appendChild(rail);
		}

		const handle = document.createElement('button');
		handle.type = 'button';
		handle.className = `painel-resize-handle eixo-${handleConfig.axis}`;
		handle.dataset.panelResizeHandle = `${block.id}:${handleConfig.key}`;
		handle.setAttribute('aria-label', t('chive-panel-resize-handle'));
		if (handleConfig.axis === 'x') {
			handle.style.left = `${clampPercent(handleConfig.position, 20, 80)}%`;
		} else {
			handle.style.top = `${clampPercent(handleConfig.position, 20, 80)}%`;
			handle.style.left = `${railCenter}%`;
		}

		handle.addEventListener('mousedown', event => {
			event.preventDefault();
			startGuidedResizeDrag(block.id, block.templateId, handleConfig.key, gridDiv);
		});

		gridDiv.appendChild(handle);
	});
}

function startGuidedResizeDrag(blockId, templateId, key, gridDiv) {
	const rect = gridDiv.getBoundingClientRect();
	if (!rect.width || !rect.height) return;
	gridDiv.classList.add('is-resizing');

	const onMove = event => {
		const currentBlock = getPanelBlocks().find(item => item.id === blockId);
		if (!currentBlock) return;

		if (templateId === 'layout-2col' && key === 'split') {
			const next = ((event.clientX - rect.left) / rect.width) * 100;
			updatePanelBlockProportions(blockId, { split: clampPercent(next, 20, 80) });
		} else if (templateId === 'layout-1x2' && key === 'split') {
			const next = ((event.clientY - rect.top) / rect.height) * 100;
			updatePanelBlockProportions(blockId, { split: clampPercent(next, 20, 80) });
		} else if (templateId === 'layout-hero2' && key === 'splitMain') {
			const next = ((event.clientX - rect.left) / rect.width) * 100;
			updatePanelBlockProportions(blockId, { splitMain: clampPercent(next, 20, 80) });
		} else if (templateId === 'layout-hero2' && key === 'splitRight') {
			const next = ((event.clientY - rect.top) / rect.height) * 100;
			updatePanelBlockProportions(blockId, { splitRight: clampPercent(next, 20, 80) });
		} else if (templateId === 'layout-3col' && key === 'a') {
			const next = ((event.clientX - rect.left) / rect.width) * 100;
			const a = clampPercent(next, 20, 60);
			const remaining = 100 - a;
			let b = clampPercent(currentBlock.proportions.b ?? 33, 20, 60);
			if (b > remaining - 20) b = remaining - 20;
			const c = 100 - a - b;
			updatePanelBlockProportions(blockId, { a, b, c });
		} else if (templateId === 'layout-3col' && key === 'ab') {
			const next = ((event.clientX - rect.left) / rect.width) * 100;
			const a = clampPercent(currentBlock.proportions.a ?? 33, 20, 60);
			const ab = clampPercent(next, a + 20, 80);
			const b = ab - a;
			const c = 100 - ab;
			updatePanelBlockProportions(blockId, { a, b, c });
		}

		renderCanvasPanel();
	};

	const onUp = () => {
		window.removeEventListener('mousemove', onMove);
		window.removeEventListener('mouseup', onUp);
		gridDiv.classList.remove('is-resizing');
	};

	window.addEventListener('mousemove', onMove);
	window.addEventListener('mouseup', onUp);
}

function startBlockHeightResizeDrag(blockId, gridDiv, startClientY) {
	const rect = gridDiv.getBoundingClientRect();
	if (!rect.height) return;

	const startY = Number(startClientY);
	if (!Number.isFinite(startY)) return;
	gridDiv.classList.add('is-resizing');
	const startHeight = rect.height;

	const onMove = event => {
		const deltaY = event.clientY - startY;
		const nextHeight = startHeight + deltaY;
		updatePanelBlockHeight(blockId, nextHeight);
		renderCanvasPanel();
	};

	const onUp = () => {
		window.removeEventListener('mousemove', onMove);
		window.removeEventListener('mouseup', onUp);
		gridDiv.classList.remove('is-resizing');
	};

	window.addEventListener('mousemove', onMove);
	window.addEventListener('mouseup', onUp);
}

/**
 * Fill layout selector dropdown
 * @private
 */
function fillLayoutSelect() {
	const select = document.getElementById('select-panel-layout');
	if (!select) return;
	const blocks = getPanelBlocks();
	const currentLayout = blocks[0]?.templateId || 'layout-2col';
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
	const blocks = getPanelBlocks();
	if (!blocks[0]) return;
	setPanelBlockTemplate(blocks[0].id, layoutId);
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

		// Add each chart in rendered slots (all blocks)
		const slotElements = canvas.querySelectorAll('[data-panel-slot][data-panel-chart-id]');
		slotElements.forEach(slotEl => {
			const chart = getChartSnapshot(slotEl.dataset.panelChartId);
			if (!chart) return;

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
