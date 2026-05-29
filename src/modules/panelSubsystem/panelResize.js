/**
 * CHIVE panel block resize interactions.
 *
 * Mouse-driven proportion and height resizing for panel blocks. Each
 * drag handler attaches `mousemove`/`mouseup` to `window` (not the grid)
 * so the drag tracks the cursor even outside the grid bounds.
 *
 * @typedef {import('../../types.js').PanelBlock} PanelBlock
 */

import {
	clampPercent,
	computeDynamicMinHeight,
} from './resizeMath.js';
import {
	getPanelBlocks,
	updatePanelBlockProportions,
	updatePanelBlockHeight,
} from '../state/appState.js';
import { t } from '../../services/i18nService.js';

/**
 * Apply a block's proportions to its grid element as CSS custom
 * properties (e.g. `--split: 50%`), then update the grid's `min-height`
 * via {@link applyDynamicBlockHeight}.
 *
 * No-op when the block has no proportions object.
 *
 * @param {HTMLElement} gridDiv
 * @param {PanelBlock} block
 */
export function applyBlockProportions(gridDiv, block) {
	if (!block?.proportions) return;
	Object.entries(block.proportions).forEach(([key, value]) => {
		gridDiv.style.setProperty(`--${key}`, `${value}%`);
	});
	applyDynamicBlockHeight(gridDiv, block);
}

/**
 * Compute and apply a block's `min-height`. Two layers of clamping are
 * intentional, see the inline comment below.
 *
 * @private
 */
function applyDynamicBlockHeight(gridDiv, block) {
	// WHY: 220 is the floor when the layout makes no extra demand; 760 caps user-driven
	// heights so an aggressive drag can't push a block off-screen. The dynamicMinHeight
	// from computeDynamicMinHeight overrides the floor when a small split percentage
	// would otherwise crush a row below SLOT_MIN_HEIGHT.
	const BASE_MIN_HEIGHT = 220;
	const dynamicMinHeight = computeDynamicMinHeight(block.templateId, block.proportions);
	const userHeight = Number(block.heightPx);
	const userBounded = Number.isFinite(userHeight)
		? Math.max(BASE_MIN_HEIGHT, Math.min(userHeight, 760))
		: BASE_MIN_HEIGHT;
	const bounded = Math.max(userBounded, dynamicMinHeight);
	gridDiv.style.minHeight = `${Math.round(bounded)}px`;
}

/**
 * Render the proportion-drag handles overlaid on a block's grid. Each
 * template gets a different set of handles, vertical splits on the
 * x-axis, horizontal splits on the y-axis. `template-hero2`'s right-column
 * y-handle is positioned on a rail that follows the main split.
 *
 * Each handle's `mousedown` starts a drag via {@link startGuidedResizeDrag}.
 * No-op when grid or proportions are missing.
 *
 * @param {HTMLElement} gridDiv
 * @param {PanelBlock} block
 * @param {() => void} renderCanvasPanel - Self-reference invoked after each proportion mutation so the canvas redraws.
 */
export function renderGuidedResizeHandles(gridDiv, block, renderCanvasPanel) {
	if (!gridDiv || !block?.proportions) return;

	const handles = [];
	if (block.templateId === 'template-2col') {
		handles.push({ key: 'split', axis: 'x', position: block.proportions.split ?? 50 });
	} else if (block.templateId === 'template-1x2') {
		handles.push({ key: 'split', axis: 'y', position: block.proportions.split ?? 50, railStart: 0, railEnd: 100 });
	} else if (block.templateId === 'template-hero2') {
		const splitMain = clampPercent(block.proportions.splitMain ?? 60, 20, 80);
		handles.push({ key: 'splitMain', axis: 'x', position: splitMain });
		handles.push({
			key: 'splitRight',
			axis: 'y',
			position: block.proportions.splitRight ?? 50,
			railStart: splitMain,
			railEnd: 100,
		});
	} else if (block.templateId === 'template-3col') {
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
			rail.className = 'panel-resize-rail axis-y';
			rail.style.left = `${railCenter}%`;
			rail.style.width = `calc(${railSpan}% - 10px)`;
			gridDiv.appendChild(rail);
		}

		const handle = document.createElement('button');
		handle.type = 'button';
		handle.className = `panel-resize-handle axis-${handleConfig.axis}`;
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

/**
 * Begin a guided proportion drag. Attaches `mousemove`/`mouseup` to
 * `window` so the drag survives the cursor leaving the grid. The
 * `mousemove` handler maps cursor position to a new proportion and
 * writes it via {@link updatePanelBlockProportions}.
 *
 * @private
 */
function startGuidedResizeDrag(blockId, templateId, key, gridDiv, renderCanvasPanel) {
	const rect = gridDiv.getBoundingClientRect();
	if (!rect.width || !rect.height) return;
	gridDiv.classList.add('is-resizing');

	const onMove = event => {
		// WHY: re-read state on every move so a concurrent block removal does not
		// crash the drag. The block reference captured at drag start could become
		// stale (e.g. user removes the block via the header button mid-drag).
		const currentBlock = getPanelBlocks().find(item => item.id === blockId);
		if (!currentBlock) return;

		if (templateId === 'template-2col' && key === 'split') {
			const next = ((event.clientX - rect.left) / rect.width) * 100;
			updatePanelBlockProportions(blockId, { split: clampPercent(next, 20, 80) });
		} else if (templateId === 'template-1x2' && key === 'split') {
			const next = ((event.clientY - rect.top) / rect.height) * 100;
			updatePanelBlockProportions(blockId, { split: clampPercent(next, 20, 80) });
		} else if (templateId === 'template-hero2' && key === 'splitMain') {
			const next = ((event.clientX - rect.left) / rect.width) * 100;
			updatePanelBlockProportions(blockId, { splitMain: clampPercent(next, 20, 80) });
		} else if (templateId === 'template-hero2' && key === 'splitRight') {
			const next = ((event.clientY - rect.top) / rect.height) * 100;
			updatePanelBlockProportions(blockId, { splitRight: clampPercent(next, 20, 80) });
		} else if (templateId === 'template-3col' && key === 'a') {
			const next = ((event.clientX - rect.left) / rect.width) * 100;
			const a = clampPercent(next, 20, 60);
			const remaining = 100 - a;
			let b = clampPercent(currentBlock.proportions.b ?? 33, 20, 60);
			if (b > remaining - 20) b = remaining - 20;
			const c = 100 - a - b;
			updatePanelBlockProportions(blockId, { a, b, c });
		} else if (templateId === 'template-3col' && key === 'ab') {
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

/**
 * Begin a block-height drag (the bottom resize handle). Like the guided
 * proportion drag, attaches listeners to `window` so the drag tracks
 * outside the grid. Each `mousemove` writes the new height via
 * {@link updatePanelBlockHeight} (which clamps).
 *
 * @param {string} blockId
 * @param {HTMLElement} gridDiv
 * @param {number} startClientY - The `event.clientY` at drag start.
 * @param {() => void} renderCanvasPanel
 */
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
