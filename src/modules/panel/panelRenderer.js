import { t } from '../../services/i18nService.js';
import {
	LAYOUTS_PAINEL,
	getTemplateForBlock,
} from './layoutConfig.js';
import { normalizeHexColor } from './resizeMath.js';
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
	assignChartToPanelBlockSlot,
	setPanelBlockTemplate,
	addPanelBlock,
	removePanelBlock,
	movePanelBlock,
	updatePanelBlockBorder,
	validatePanelSlots,
} from '../appState.js';
import { applyBlockProportions, renderGuidedResizeHandles, startBlockHeightResizeDrag } from './panelResize.js';
import { mountSlot, teardownAllSlots } from './slotLifecycle.js';

export function renderSidebarPanel(removeChartFromPanel) {
	const lista = document.getElementById('lista-painel-charts');
	if (!lista) return;

	teardownAllSlots(lista);

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

		// Preview section (live D3 render)
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

export function renderCanvasPanel(renderCanvasPanelFn, feedbackCallback) {
	validatePanelSlots();
	const canvas = document.getElementById('panel-layout-canvas');
	if (!canvas) return;
	const blocks = getPanelBlocks();
	const desktopDnd = window.matchMedia('(min-width: 901px)').matches;

	teardownAllSlots(canvas);
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
				renderCanvasPanelFn();
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
		renderGuidedResizeHandles(gridDiv, block, renderCanvasPanelFn);

		const borderControls = createBlockBorderControls({
			blockId: block.id,
			borderEnabled: block.borderEnabled,
			borderColor: block.borderColor,
			translate: t,
			normalizeHexColor,
			onToggleBorder: enabled => {
				updatePanelBlockBorder(block.id, { enabled });
				renderCanvasPanelFn();
			},
			onPreviewColor: previewColor => {
				gridDiv.style.setProperty('--panel-slot-border-color', previewColor);
				gridDiv.querySelectorAll('[data-panel-slot]').forEach(slotEl => {
					slotEl.dataset.panelBorderColor = previewColor;
				});
			},
			onChangeColor: color => {
				updatePanelBlockBorder(block.id, { color });
				renderCanvasPanelFn();
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
					renderCanvasPanelFn();
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

					renderCanvasPanelFn();
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
			startBlockHeightResizeDrag(block.id, gridDiv, event.clientY, renderCanvasPanelFn);
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

	canvas.querySelectorAll('[data-panel-slot][data-panel-chart-id]').forEach(slotEl => {
		const chart = getChartSnapshot(slotEl.dataset.panelChartId);
		if (!chart) return;
		const svgContainer = slotEl.querySelector('.painel-slot-svg');
		if (!svgContainer) return;
		mountSlot(svgContainer, chart);
	});
}

export function fillLayoutSelect() {
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
