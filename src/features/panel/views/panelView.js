/**
 * CHIVE panel renderer.
 *
 * Renders both panel surfaces, the sidebar list of saved chart snapshots
 * and the canvas grid of layout blocks. Both surfaces are rendered from
 * scratch on every call; teardown/re-mount lifecycles for slot charts
 * (SVG or WebGL canvas) go through `slots/lifecycle.js` so chart resources
 * (network simulations, canvas dispose hooks, ResizeObservers, RAF
 * handles) get cleaned up before each re-render.
 *
 * Caller wiring lives in `panelController.js`. The exports here are pure
 * rendering, they do not subscribe to state changes; the controller
 * decides when to call them.
 */

import { t } from '../../../services/i18nService.js';
import {
	PANEL_LAYOUTS,
	getTemplateForBlock,
} from '../../../domain/panel/layoutTemplates.js';
import { normalizeHexColor } from '../layout/resizeMath.js';
import {
	createAddBlockControls,
	createBlockBorderControls,
	createBlockHeader,
	createBlockTemplateSelect,
	createPanelSlotElement,
} from './domBuilders.js';
import {
	getPanelCharts,
	getPanelBlocks,
	getChartSnapshot,
} from '../../../state/appState.js';
import { applyBlockProportions, renderGuidedResizeHandles, startBlockHeightResizeDrag } from '../layout/resize.js';
import { mountSlot, teardownAllSlots } from '../slots/lifecycle.js';

/**
 * Render the sidebar list of saved chart snapshots into
 * `#panel-chart-list`. Each item gets a thumbnail (live chart render via
 * {@link mountSlot}) and a remove button wired to the provided callback.
 *
 * No-op when the container element is missing.
 *
 * @param {(chartId: number | string) => void} removeChartFromPanel - Callback for the per-item remove button; usually `panelController.removeChartFromPanel`.
 */
export function renderSidebarPanel(removeChartFromPanel) {
	const lista = document.getElementById('panel-chart-list');
	if (!lista) return;

	teardownAllSlots(lista);

	const charts = getPanelCharts();
	if (charts.length === 0) {
		lista.replaceChildren();
		const emptyDiv = document.createElement('div');
		emptyDiv.className = 'panel-empty';
		emptyDiv.textContent = t('chive-panel-empty-sidebar');
		lista.appendChild(emptyDiv);
		return;
	}

	const desktopDnd = window.matchMedia('(min-width: 901px)').matches;
	lista.replaceChildren();

	charts.forEach(chart => {
		const article = document.createElement('article');
		article.className = 'panel-item';
		article.draggable = desktopDnd;
		article.dataset.panelChartId = chart.id;

		// Top section with title and remove button
		const topo = document.createElement('div');
		topo.className = 'panel-item-top';

		const titulo = document.createElement('span');
		titulo.className = 'panel-item-title';
		titulo.textContent = chart.name; // textContent for XSS prevention
		titulo.title = chart.name;

		const metaResumo = typeof chart.metaSummary === 'string' ? chart.metaSummary.trim() : '';
		const subtitulo = document.createElement('span');
		subtitulo.className = 'panel-item-subtitle';
		subtitulo.textContent = metaResumo;
		subtitulo.hidden = metaResumo.length === 0;

		const removeBtn = document.createElement('button');
		removeBtn.className = 'panel-item-remove';
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

		// Preview section (live chart render)
		const preview = document.createElement('div');
		preview.className = 'panel-item-preview';

		article.appendChild(topo);
		article.appendChild(preview);
		lista.appendChild(article);

		mountSlot(preview, chart);

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
 * Render the panel canvas (layout grid + block stack) into
 * `#panel-layout-canvas`. Walks every block, builds its DOM via
 * {@link createBlockElement}, wires resize listeners, and mounts each
 * slot's chart via {@link mountSlot}.
 *
 * The renderer never imports panel write facades; every user action that
 * mutates panel state is surfaced through the callback bag below.
 * panelController.js owns the callbacks and re-renders via STATE_EVENTS
 * subscriptions, not via direct calls from these handlers.
 *
 * No-op when the canvas element is missing.
 *
 * @param {Object} callbacks
 * @param {(templateId: string) => void} callbacks.onAddBlock
 * @param {(blockId: string, newIndex: number) => void} callbacks.onMoveBlock
 * @param {(blockId: string) => void} callbacks.onRemoveBlock
 * @param {(blockId: string, templateId: string) => void} callbacks.onChangeBlockTemplate
 * @param {(blockId: string, patch: { enabled?: boolean, color?: string }) => void} callbacks.onUpdateBlockBorder
 * @param {(blockId: string, slotId: string, chartId: number | string | null) => void} callbacks.onAssignSlot
 * @param {(blockId: string, proportions: Object) => void} callbacks.onUpdateBlockProportions
 * @param {(blockId: string, heightPx: number) => void} callbacks.onUpdateBlockHeight
 */
export function renderCanvasPanel(callbacks) {
	const canvas = document.getElementById('panel-layout-canvas');
	if (!canvas) return;
	const blocks = getPanelBlocks();
	const desktopDnd = window.matchMedia('(min-width: 901px)').matches;

	teardownAllSlots(canvas);
	canvas.replaceChildren();

	const stack = document.createElement('div');
	stack.className = 'panel-block-stack';

	blocks.forEach((block, index) => {
		const { blockEl, gridDiv } = createBlockElement(block, {
			index,
			totalBlocks: blocks.length,
			desktopDnd,
			callbacks,
		});
		attachBlockResizeListener(blockEl, block, gridDiv, callbacks);
		stack.appendChild(blockEl);
	});

	const addControls = createAddBlockControls({
		layouts: PANEL_LAYOUTS,
		translate: t,
		onAddBlock: callbacks.onAddBlock,
	});

	canvas.appendChild(stack);
	canvas.appendChild(addControls);

	canvas.querySelectorAll('[data-panel-slot][data-panel-chart-id]').forEach(slotEl => {
		const chart = getChartSnapshot(slotEl.dataset.panelChartId);
		if (!chart) return;
		const svgContainer = slotEl.querySelector('.panel-slot-svg');
		if (!svgContainer) return;
		mountSlot(svgContainer, chart);
	});
}

/**
 * Assemble a single panel block's `<section>` element with header,
 * template select, border controls, and grid + slots. Returns both the
 * block element and its grid so {@link attachBlockResizeListener} can
 * wire to the grid without a DOM query.
 *
 * @private
 */
function createBlockElement(block, { index, totalBlocks, desktopDnd, callbacks }) {
	const layout = getTemplateForBlock(block);
	const blockEl = document.createElement('section');
	blockEl.className = 'panel-block';
	blockEl.dataset.panelBlockId = block.id;

	const header = createBlockHeader({
		blockId: block.id,
		index,
		totalBlocks,
		translate: t,
		onMoveUp: () => callbacks.onMoveBlock(block.id, index - 1),
		onMoveDown: () => callbacks.onMoveBlock(block.id, index + 1),
		onRemove: () => callbacks.onRemoveBlock(block.id),
	});

	const templateSelect = createBlockTemplateSelect({
		blockId: block.id,
		templateId: block.templateId,
		layouts: PANEL_LAYOUTS,
		translate: t,
		onTemplateChange: e => callbacks.onChangeBlockTemplate(block.id, e.target.value),
	});

	const gridDiv = document.createElement('div');
	gridDiv.className = `panel-layout ${layout.cssClass}`;
	gridDiv.dataset.panelLayoutBlock = block.id;
	const borderColor = normalizeHexColor(block.borderColor);
	if (block.borderEnabled) {
		gridDiv.classList.add('slot-borders-enabled');
		gridDiv.style.setProperty('--panel-slot-border-color', borderColor);
	}
	applyBlockProportions(gridDiv, block);
	renderGuidedResizeHandles(gridDiv, block, callbacks.onUpdateBlockProportions);

	const borderControls = createBlockBorderControls({
		blockId: block.id,
		borderEnabled: block.borderEnabled,
		borderColor: block.borderColor,
		translate: t,
		normalizeHexColor,
		onToggleBorder: enabled => callbacks.onUpdateBlockBorder(block.id, { enabled }),
		// WHY: preview-only path; writes CSS variables for live feedback while the
		// user drags the color picker. onChangeColor is the commit path that lands
		// the durable write through the callback bag.
		onPreviewColor: previewColor => {
			gridDiv.style.setProperty('--panel-slot-border-color', previewColor);
			gridDiv.querySelectorAll('[data-panel-slot]').forEach(slotEl => {
				slotEl.dataset.panelBorderColor = previewColor;
			});
		},
		onChangeColor: color => callbacks.onUpdateBlockBorder(block.id, { color }),
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
			onClearSlot: () => callbacks.onAssignSlot(block.id, slotId, null),
			onDropData: ({ targetSlotId, targetBlockId, sourceSlotId, sourceBlockId, chartId }) => {
				if (!chartId || !getChartSnapshot(chartId)) return;

				if (sourceSlotId && sourceBlockId) {
					if (sourceSlotId === targetSlotId && sourceBlockId === targetBlockId) return;

					const stateBlocks = getPanelBlocks();
					const targetBlock = stateBlocks.find(item => item.id === targetBlockId);
					const targetChartId = targetBlock?.slots?.[targetSlotId] ?? null;

					callbacks.onAssignSlot(targetBlockId, targetSlotId, chartId);
					if (targetChartId !== null && targetChartId !== undefined) {
						callbacks.onAssignSlot(sourceBlockId, sourceSlotId, targetChartId);
					} else {
						callbacks.onAssignSlot(sourceBlockId, sourceSlotId, null);
					}
				} else {
					callbacks.onAssignSlot(targetBlockId, targetSlotId, chartId);
				}
			},
		});

		gridDiv.appendChild(slot);
	});

	blockEl.appendChild(header);
	blockEl.appendChild(templateSelect);
	blockEl.appendChild(borderControls);
	blockEl.appendChild(gridDiv);

	return { blockEl, gridDiv };
}

/**
 * Append a block-height resize handle and wire its mousedown to
 * {@link startBlockHeightResizeDrag}.
 *
 * @private
 */
function attachBlockResizeListener(blockEl, block, gridDiv, callbacks) {
	const handle = document.createElement('button');
	handle.type = 'button';
	handle.className = 'panel-block-size-handle';
	handle.dataset.panelBlockResize = block.id;
	handle.setAttribute('aria-label', t('chive-panel-resize-block-height'));
	handle.addEventListener('mousedown', event => {
		event.preventDefault();
		startBlockHeightResizeDrag(block.id, gridDiv, event.clientY, callbacks.onUpdateBlockHeight);
	});
	blockEl.appendChild(handle);
}

/**
 * Populate the layout `<select>` (in the panel header) with the available
 * templates, pre-selecting the first block's template. Safe to call on
 * every state change.
 *
 * No-op when the select element is missing.
 */
export function fillLayoutSelect() {
	const select = document.getElementById('select-panel-layout');
	if (!select) return;
	const blocks = getPanelBlocks();
	const currentLayout = blocks[0]?.templateId || 'template-2col';
	select.replaceChildren();

	Object.entries(PANEL_LAYOUTS).forEach(([id, layout]) => {
		const option = document.createElement('option');
		option.value = id;
		option.textContent = t(layout.labelKey);
		option.selected = id === currentLayout;
		select.appendChild(option);
	});
}
