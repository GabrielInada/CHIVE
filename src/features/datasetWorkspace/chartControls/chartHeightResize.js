/**
 * Chart height drag handles.
 *
 * Replaces the per-chart height slider: a bottom-center handle on each
 * static chart block resizes the chart by dragging, mirroring the panel
 * block height drag (`features/panel/layout/resize.js`). Lives in the
 * chartControls layer because the drag writes chart config; renderers
 * (`components/`) must stay stateless.
 *
 * The height goes through the chart's ChartConfigWriter, as the chart's
 * controls write theirs. While a drag runs, `preview` stores the height
 * without emitting and repaints the chart through the throttled live render,
 * exactly like a color picker's `input`; `commit` runs once on release so
 * DATASET_CONFIG_UPDATED, the sidebar refresh, and auto-save fire with the final
 * height.
 *
 * @typedef {import('../../../types.js').ChartTypeKey} ChartTypeKey
 */

import { CHART_BLOCKS, CHART_CONTAINERS } from '../../../charts/workspaceDomIds.js';
import { CHART_HEIGHT_LIMITS } from '../../../config/charts/definitions.js';
import { getActiveDataset } from '../../../state/appState.js';
import { createChartConfigWriter } from './chartConfigAdapter.js';
import { triggerLiveRender } from './livePreviewBridge.js';
import { t } from '../../../services/i18nService.js';
import { clamp } from '../../../utils/formatters.js';

const KEYBOARD_STEP_PX = 10;

/**
 * Ensure every chart block has its height drag handle. Idempotent: the
 * chart blocks are static DOM, so each handle is created once and later
 * calls only refresh its aria-label (locale changes re-render the
 * sidebar, which calls this again). Living outside the chart container
 * keeps the handle clear of the D3 renderers, which replace the
 * container's children on every render. Missing blocks are skipped.
 */
export function ensureChartHeightResizeHandles() {
	Object.keys(CHART_HEIGHT_LIMITS).forEach(ensureHandleForChart);
}

/** @private */
function ensureHandleForChart(chartKey) {
	const block = document.getElementById(CHART_BLOCKS[chartKey]);
	const container = document.getElementById(CHART_CONTAINERS[chartKey]);
	if (!block || !container) return;

	let handle = block.querySelector('.chart-height-resize-handle');
	if (!handle) {
		handle = document.createElement('button');
		handle.type = 'button';
		handle.className = 'chart-height-resize-handle';
		handle.addEventListener('pointerdown', event => {
			if (event.button !== 0) return;
			event.preventDefault();
			startChartHeightDrag(chartKey, block, container, event.clientY);
		});
		handle.addEventListener('keydown', event => {
			if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
			event.preventDefault();
			const delta = event.key === 'ArrowUp' ? -KEYBOARD_STEP_PX : KEYBOARD_STEP_PX;
			commitChartHeight(chartKey, readChartHeight(chartKey, container) + delta);
		});
		block.appendChild(handle);
	}
	handle.setAttribute('aria-label', t('chive-chart-resize-height'));
}

/**
 * The configured height, clamped to the chart's limits. Falls back to the
 * rendered box when the config has no finite height yet.
 *
 * @private
 */
function readChartHeight(chartKey, container) {
	const { min, max } = CHART_HEIGHT_LIMITS[chartKey];
	const configured = Number(getActiveDataset()?.chartConfig?.[chartKey]?.chartHeight);
	if (Number.isFinite(configured)) return clamp(configured, min, max);
	return clamp(container.getBoundingClientRect().height, min, max);
}

/**
 * Commit a height from the keyboard, clamped to the chart's limits. Same cost
 * and effects as a control's `change`: DATASET_CONFIG_UPDATED, sidebar refresh,
 * auto-save dirty.
 *
 * @private
 */
function commitChartHeight(chartKey, heightPx) {
	const dataset = getActiveDataset();
	if (!dataset) return;
	const { min, max } = CHART_HEIGHT_LIMITS[chartKey];
	createChartConfigWriter({ dataset, chartKey }).commit({ chartHeight: Math.round(clamp(heightPx, min, max)) });
}

/**
 * Begin a height drag. Mirrors `resize.startBlockHeightResizeDrag`
 * but with Pointer Events (touch and pen included). Listeners attach to
 * `window` so the drag tracks the cursor outside the block and survives
 * the live render rebuilding the chart mid-drag.
 *
 * @private
 */
function startChartHeightDrag(chartKey, block, container, startClientY) {
	const startY = Number(startClientY);
	const dataset = getActiveDataset();
	// The chart blocks only show while a dataset is open.
	if (!Number.isFinite(startY) || !dataset) return;
	const writer = createChartConfigWriter({ dataset, chartKey, requestLiveRender: triggerLiveRender });
	const { min, max } = CHART_HEIGHT_LIMITS[chartKey];
	const startHeight = readChartHeight(chartKey, container);
	block.classList.add('is-resizing');
	let lastHeight = null;

	const onMove = event => {
		const next = Math.round(clamp(startHeight + (event.clientY - startY), min, max));
		if (next === lastHeight) return;
		lastHeight = next;
		// Direct write so the box tracks the cursor between throttled renders.
		container.style.minHeight = `${next}px`;
		writer.preview({ chartHeight: next });
	};

	const onUp = () => {
		window.removeEventListener('pointermove', onMove);
		window.removeEventListener('pointerup', onUp);
		window.removeEventListener('pointercancel', onUp);
		block.classList.remove('is-resizing');
		if (lastHeight !== null && lastHeight !== startHeight) {
			writer.commit({ chartHeight: lastHeight });
		}
	};

	window.addEventListener('pointermove', onMove);
	window.addEventListener('pointerup', onUp);
	window.addEventListener('pointercancel', onUp);
}
