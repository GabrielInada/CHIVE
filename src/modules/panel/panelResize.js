import {
	clampPercent,
	computeDynamicMinHeight,
} from './resizeMath.js';
import {
	getPanelBlocks,
	updatePanelBlockProportions,
	updatePanelBlockHeight,
} from '../appState.js';
import { t } from '../../services/i18nService.js';

export function applyBlockProportions(gridDiv, block) {
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

export function renderGuidedResizeHandles(gridDiv, block, renderCanvasPanel) {
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
			startGuidedResizeDrag(block.id, block.templateId, handleConfig.key, gridDiv, renderCanvasPanel);
		});

		gridDiv.appendChild(handle);
	});
}

function startGuidedResizeDrag(blockId, templateId, key, gridDiv, renderCanvasPanel) {
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

export function startBlockHeightResizeDrag(blockId, gridDiv, startClientY, renderCanvasPanel) {
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
