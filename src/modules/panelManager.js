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
import { captureSvgMarkupFromContainer, downloadSvgMarkup } from '../utils/svgExport.js';
import {
	LAYOUTS_PAINEL,
	getLayoutConfig as getPanelLayoutConfig,
	getTemplateForBlock,
} from './panel/layoutConfig.js';
import {
	clampPercent,
	normalizeHexColor,
	computeDynamicMinHeight,
} from './panel/resizeMath.js';
import {
	createAddBlockControls,
	createBlockBorderControls,
	createBlockHeader,
	createBlockTemplateSelect,
	createPanelSlotElement,
} from './panel/domBuilders.js';
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
	updatePanelBlockBorder,
	validatePanelSlots,
	clearPanel,
	onStateChange,
} from './appState.js';

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
	onStateChange('panelBlockBorderUpdated', handleLayoutChange);
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
export function addChartToPanel(containerId, chartBaseName, metadata = null) {
	try {
		const captured = captureSvgMarkupFromContainer(containerId);
		if (!captured.ok) {
			return captured;
		}

		const chartId = addChartSnapshot({
			nome: chartBaseName,
			svgMarkup: captured.svgMarkup,
			metadata,
			metaSummary: typeof metadata?.summary === 'string' ? metadata.summary : '',
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
	return getPanelLayoutConfig(layoutId);
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

		const metaResumo = typeof chart.metaSummary === 'string' ? chart.metaSummary.trim() : '';
		const subtitulo = document.createElement('span');
		subtitulo.className = 'panel-item-subtitulo';
		subtitulo.textContent = metaResumo;
		subtitulo.hidden = metaResumo.length === 0;

		const removeBtn = document.createElement('button');
		removeBtn.className = 'panel-item-remover';
		removeBtn.type = 'button';
		removeBtn.dataset.removePanelChart = chart.id;
		removeBtn.setAttribute('aria-label', t('chive-panel-remove-chart'));
		removeBtn.textContent = '×';

		const titleWrap = document.createElement('div');
		titleWrap.className = 'panel-item-title-wrap';
		titleWrap.appendChild(titulo);
		titleWrap.appendChild(subtitulo);

		topo.appendChild(titleWrap);
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

		const header = createBlockHeader({
			blockId: block.id,
			index,
			totalBlocks: blocks.length,
			onMoveUp: () => movePanelBlock(block.id, index - 1),
			onMoveDown: () => movePanelBlock(block.id, index + 1),
			onRemove: () => removePanelBlock(block.id),
		});

		const templateSelect = createBlockTemplateSelect({
			blockId: block.id,
			templateId: block.templateId,
			layouts: LAYOUTS_PAINEL,
			translate: t,
			onTemplateChange: e => {
				setPanelBlockTemplate(block.id, e.target.value);
				fillLayoutSelect();
				renderCanvasPanel();
			},
		});

		const gridDiv = document.createElement('div');
		gridDiv.className = `painel-layout ${layout.classe}`;
		gridDiv.dataset.panelLayoutBlock = block.id;
		const borderColor = normalizeHexColor(block.borderColor);
		if (block.borderEnabled) {
			gridDiv.classList.add('slot-borders-enabled');
			gridDiv.style.setProperty('--panel-slot-border-color', borderColor);
		}
		applyBlockProportions(gridDiv, block);
		renderGuidedResizeHandles(gridDiv, block);

		const borderControls = createBlockBorderControls({
			blockId: block.id,
			borderEnabled: block.borderEnabled,
			borderColor: block.borderColor,
			translate: t,
			normalizeHexColor,
			onToggleBorder: enabled => {
				updatePanelBlockBorder(block.id, { enabled });
				renderCanvasPanel();
			},
			onPreviewColor: previewColor => {
				gridDiv.style.setProperty('--panel-slot-border-color', previewColor);
				gridDiv.querySelectorAll('[data-panel-slot]').forEach(slotEl => {
					slotEl.dataset.panelBorderColor = previewColor;
				});
			},
			onChangeColor: color => {
				updatePanelBlockBorder(block.id, { color });
				renderCanvasPanel();
			},
		});

		layout.slots.forEach(slotId => {
			const chart = getChartSnapshot(block.slots?.[slotId]);
			const slot = createPanelSlotElement({
				slotId,
				blockId: block.id,
				chart,
				borderEnabled: Boolean(block.borderEnabled),
				borderColor,
				desktopDnd,
				translate: t,
				onClearSlot: () => {
					assignChartToPanelBlockSlot(block.id, slotId, null);
					renderCanvasPanel();
				},
				onDropData: ({ targetSlotId, targetBlockId, sourceSlotId, sourceBlockId, chartId }) => {
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
				},
			});

			gridDiv.appendChild(slot);
		});

		blockEl.appendChild(header);
		blockEl.appendChild(templateSelect);
		blockEl.appendChild(borderControls);
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

	const addControls = createAddBlockControls({
		layouts: LAYOUTS_PAINEL,
		translate: t,
		onAddBlock: templateId => {
			const newBlockId = addPanelBlock(templateId);
			if (newBlockId === null && feedbackCallback) {
				feedbackCallback(t('chive-panel-max-blocks'), 'error');
			}
		},
	});

	canvas.appendChild(stack);
	canvas.appendChild(addControls);
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
	const dynamicMinHeight = computeDynamicMinHeight(block.templateId, block.proportions);
	const userHeight = Number(block.heightPx);
	const userBounded = Number.isFinite(userHeight)
		? Math.max(BASE_MIN_HEIGHT, Math.min(userHeight, 760))
		: BASE_MIN_HEIGHT;
	const bounded = Math.max(userBounded, dynamicMinHeight);
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

		const allSlots = canvas.querySelectorAll('[data-panel-slot]');
		allSlots.forEach(slotEl => {
			const includeSlotBorder = slotEl.dataset.panelBorderEnabled === '1';
			if (!includeSlotBorder) return;
			const slotBorderColor = normalizeHexColor(slotEl.dataset.panelBorderColor, '#5d645d');
				const slotRect = slotEl.getBoundingClientRect();
				const x = slotRect.left - rectCanvas.left;
				const y = slotRect.top - rectCanvas.top;
				const w = slotRect.width;
				const h = slotRect.height;

				const border = docSvg.createElementNS('http://www.w3.org/2000/svg', 'rect');
				border.setAttribute('x', String(x));
				border.setAttribute('y', String(y));
				border.setAttribute('width', String(w));
				border.setAttribute('height', String(h));
				border.setAttribute('fill', 'none');
				border.setAttribute('stroke', slotBorderColor);
				border.setAttribute('stroke-width', '2');
				border.setAttribute('rx', '8');
				border.setAttribute('ry', '8');
				if (slotEl.classList.contains('vazio')) {
					border.setAttribute('stroke-dasharray', '6 4');
				}
				svgRoot.appendChild(border);
		});

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
		return downloadSvgMarkup(svgString, 'panel-layout');
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
