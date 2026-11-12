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
	PANEL_TEMPLATES,
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
import { PANEL_DOM_IDS } from '../domIds.js';
import { openExpandedChart } from './expandedChart.js';

// Keep mouse/trackpad dragging available in narrow or zoomed windows.
const DRAG_POINTER_QUERY = '(any-pointer: fine)';
let dragMediaQuery = null;
let matchMediaOwner = null;
let latestSidebarRemove = null;
let latestCanvasCallbacks = null;

function getDragMediaQuery() {
	if (matchMediaOwner === window.matchMedia && dragMediaQuery) {
		return dragMediaQuery;
	}

	dragMediaQuery?.removeEventListener?.('change', handleDragCapabilityChange);
	matchMediaOwner = window.matchMedia;
	dragMediaQuery = window.matchMedia(DRAG_POINTER_QUERY);
	dragMediaQuery.addEventListener?.('change', handleDragCapabilityChange);
	return dragMediaQuery;
}

function handleDragCapabilityChange() {
	if (latestSidebarRemove && document.getElementById('panel-chart-list')) {
		renderSidebarPanel(latestSidebarRemove);
	}
	if (latestCanvasCallbacks && document.getElementById(PANEL_DOM_IDS.canvas)) {
		renderCanvasPanel(latestCanvasCallbacks);
	}
}

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
	const chartList = document.getElementById('panel-chart-list');
	if (!chartList) return;
	latestSidebarRemove = removeChartFromPanel;

	teardownAllSlots(chartList);

	const charts = getPanelCharts();
	if (charts.length === 0) {
		chartList.replaceChildren();
		const emptyDiv = document.createElement('div');
		emptyDiv.className = 'panel-empty';
		emptyDiv.textContent = t('chive-panel-empty-sidebar');
		chartList.appendChild(emptyDiv);
		return;
	}

	const desktopDnd = getDragMediaQuery().matches;
	chartList.replaceChildren();

	charts.forEach(chart => {
		const article = document.createElement('article');
		article.className = 'panel-item';
		article.draggable = desktopDnd;
		article.dataset.panelChartId = chart.id;

		// Top section with title and remove button
		const itemHeader = document.createElement('div');
		itemHeader.className = 'panel-item-top';

		const title = document.createElement('span');
		title.className = 'panel-item-title';
		title.textContent = chart.name; // textContent for XSS prevention
		title.title = chart.name;

		const metaSummary = typeof chart.metaSummary === 'string' ? chart.metaSummary.trim() : '';
		const subtitle = document.createElement('span');
		subtitle.className = 'panel-item-subtitle';
		subtitle.textContent = metaSummary;
		subtitle.hidden = metaSummary.length === 0;

		const removeBtn = document.createElement('button');
		removeBtn.className = 'panel-item-remove';
		removeBtn.type = 'button';
		removeBtn.dataset.removePanelChart = chart.id;
		removeBtn.setAttribute('aria-label', t('chive-panel-remove-chart'));
		removeBtn.textContent = '×';

		const titleWrap = document.createElement('div');
		titleWrap.className = 'panel-item-title-wrap';
		titleWrap.appendChild(title);
		titleWrap.appendChild(subtitle);

		itemHeader.appendChild(titleWrap);
		itemHeader.appendChild(removeBtn);

		// Preview section (live chart render)
		const preview = document.createElement('div');
		preview.className = 'panel-item-preview';

		article.appendChild(itemHeader);
		article.appendChild(preview);
		chartList.appendChild(article);

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
	const canvas = document.getElementById(PANEL_DOM_IDS.canvas);
	if (!canvas) return;
	latestCanvasCallbacks = callbacks;
	const blocks = getPanelBlocks();
	const desktopDnd = getDragMediaQuery().matches;

	// Disclosure choices are presentation-only and survive chart/layout updates.
	const openControls = new Map(Array.from(canvas.querySelectorAll('.panel-block-controls'),
		details => [details.dataset.panelBlockControls, details.open]));
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
			controlsOpen: openControls.get(block.id) ?? window.matchMedia('(min-width: 901px)').matches,
		});
		attachBlockResizeListener(blockEl, block, gridDiv, callbacks);
		stack.appendChild(blockEl);
	});

	const addControls = createAddBlockControls({
		templates: PANEL_TEMPLATES,
		translate: t,
		onAddBlock: callbacks.onAddBlock,
	});

	canvas.appendChild(stack);
	canvas.appendChild(addControls);

	canvas.querySelectorAll('[data-panel-slot][data-panel-chart-id]').forEach(slotEl => {
		const chart = getChartSnapshot(slotEl.dataset.panelChartId);
		if (!chart) return;
		const chartContainer = slotEl.querySelector('.panel-chart-container');
		if (!chartContainer) return;
		mountSlot(chartContainer, chart);
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
function createBlockElement(block, { index, totalBlocks, desktopDnd, callbacks, controlsOpen }) {
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
		templates: PANEL_TEMPLATES,
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
			onExpand: () => openExpandedChart(chart),
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

	const controls = document.createElement('details');
	controls.className = 'panel-block-controls';
	controls.dataset.panelBlockControls = block.id;
	controls.open = controlsOpen;
	const summary = document.createElement('summary');
	summary.className = 'panel-block-header';
	summary.appendChild(header.querySelector('.panel-block-title'));
	const editLabel = document.createElement('span');
	editLabel.className = 'panel-block-edit-label';
	editLabel.textContent = t('chive-panel-block-controls');
	summary.appendChild(editLabel);
	const controlsBody = document.createElement('div');
	controlsBody.className = 'panel-block-controls-body';
	controlsBody.append(header.querySelector('.panel-block-actions'), templateSelect, borderControls);
	controls.append(summary, controlsBody);
	blockEl.appendChild(controls);
	blockEl.appendChild(gridDiv);

	return { blockEl, gridDiv };
}

/**
 * Append a block-height resize handle and wire its primary pointer to
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
	handle.addEventListener('pointerdown', event => {
		if (event.button !== 0 || event.isPrimary === false) return;
		event.preventDefault();
		startBlockHeightResizeDrag(
			block.id,
			gridDiv,
			event.clientY,
			callbacks.onUpdateBlockHeight,
			event.pointerId,
			handle,
		);
	});
	blockEl.appendChild(handle);
}
