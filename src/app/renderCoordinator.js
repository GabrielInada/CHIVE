/**
 * CHIVE render coordinator.
 *
 * Owns full and per-region render scheduling, render-affecting state
 * subscriptions, the application-level view composition, and the callbacks
 * that bridge dataset workspace views to state facades. Each render pass
 * derives the active dataset's shown dataset once and hands that value to the
 * workspace, the controls sidebar, or live preview.
 *
 * @typedef {import('../types.js').Dataset} Dataset
 * @typedef {import('../types.js').ShownDataset} ShownDataset
 */

import { renderDatasetWorkspace } from '../features/datasetWorkspace/workspaceView.js';
import { renderFileList } from '../features/datasetWorkspace/views/fileListView.js';
import { renderEmptyState } from '../features/datasetWorkspace/views/emptyWorkspaceView.js';
import { renderCharts } from '../features/datasetWorkspace/views/chartsView.js';
import { renderChartControlsSidebar } from '../features/datasetWorkspace/chartControls/chartControlsController.js';
import { deriveShownDataset } from '../domain/datasets/shownDataset.js';
import {
	getActiveDataset,
	getActiveDatasetIndex,
	getPreviewRows,
	onStateChange,
	STATE_EVENTS,
	setPreviewRows,
	setActiveDatasetColumnSelection as setStateColumnSelection,
	updateActiveDatasetConfig,
} from '../state/appState.js';
import {
	renderLayoutSelector,
	renderSidebarPanel,
	renderCanvasPanel,
} from '../features/panel/panelController.js';
import {
	getLoadedDatasets,
	selectDataset,
	removeDatasetByIndex,
	handleJoinDatasetRequest,
	handlePresetDatasetRequest,
} from '../features/datasetWorkspace/datasetController.js';
import { syncSidebarToTab } from './uiManager.js';

// State events repaint through one animation-frame scheduler. "Full wins":
// scheduleFullRefresh() subsumes dirty regions in the same frame. The
// synchronous runFullRefreshNow() entry is reserved for boot and debugging.

const RENDER_REGIONS = Object.freeze({
	list: 'list',
	workspace: 'workspace',
	controls: 'controls',
	panel: 'panel',
});

const dirtyRegions = new Set();
let fullQueued = false;
let frameId = null;
let fullRenderInProgress = false;

/**
 * Report a render error through the shared internal-error channel.
 *
 * @private
 * @param {unknown} err
 */
function reportRefreshError(err) {
	window.dispatchEvent(new CustomEvent('chive-internal-error', {
		detail: { type: 'refresh-error', message: String(err?.message || err) },
	}));
}

/**
 * Mark a render area dirty and schedule one ordered region flush. No-op while
 * a full refresh is pending because the full refresh subsumes every region.
 *
 * @private
 * @param {(typeof RENDER_REGIONS)[keyof typeof RENDER_REGIONS]} region
 */
function scheduleRegion(region) {
	if (fullQueued || fullRenderInProgress) return;
	dirtyRegions.add(region);
	requestRenderFrame();
}

function requestRenderFrame() {
	if (frameId !== null) return;
	frameId = window.requestAnimationFrame(flushScheduledRender);
}

function flushScheduledRender() {
	frameId = null;
	if (fullQueued) {
		fullQueued = false;
		fullRenderInProgress = true;
		dirtyRegions.clear();
		try {
			refreshView();
		} catch (err) {
			reportRefreshError(err);
		} finally {
			dirtyRegions.clear();
			fullRenderInProgress = false;
		}
		return;
	}

	const regions = new Set(dirtyRegions);
	dirtyRegions.clear();
	try {
		if (regions.has(RENDER_REGIONS.list)) {
			renderDatasetListView(getLoadedDatasets(), getActiveDatasetIndex());
		}
		const shown = regions.has(RENDER_REGIONS.workspace) || regions.has(RENDER_REGIONS.controls)
			? deriveActiveShownDataset()
			: null;
		if (regions.has(RENDER_REGIONS.workspace)) {
			renderActiveDatasetWorkspace(shown, getPreviewRows());
		}
		if (regions.has(RENDER_REGIONS.controls)) {
			renderChartControlsView(shown);
		}
		if (regions.has(RENDER_REGIONS.panel)) {
			renderPanelWorkspace();
		}
	} catch (err) {
		reportRefreshError(err);
	}
}

/**
 * Schedule one coalesced full refresh on the next animation frame. The full guard
 * remains set for the render so region work emitted during it is suppressed.
 */
export function scheduleFullRefresh() {
	if (fullQueued || fullRenderInProgress) return;
	fullQueued = true;
	dirtyRegions.clear();
	requestRenderFrame();
}

/**
 * Run a full refresh synchronously with the same full-refresh protection.
 * Boot errors deliberately escape to the initializer's error boundary; debug
 * calls deliberately surface the throw in the console.
 */
export function runFullRefreshNow() {
	if (frameId !== null) {
		window.cancelAnimationFrame(frameId);
		frameId = null;
	}
	fullQueued = false;
	dirtyRegions.clear();
	fullRenderInProgress = true;
	try {
		refreshView();
	} finally {
		dirtyRegions.clear();
		fullRenderInProgress = false;
	}
}

function onColumnsUpdated() {
	scheduleRegion(RENDER_REGIONS.workspace);
	scheduleRegion(RENDER_REGIONS.controls);
}

/**
 * @param {{ activeTab?: string } & Object} [patch] - CONFIG_UPDATED payload.
 */
function onConfigUpdated(patch) {
	if (patch?.activeTab) syncSidebarToTab(patch.activeTab);
	scheduleRegion(RENDER_REGIONS.workspace);
	scheduleRegion(RENDER_REGIONS.controls);
	if (patch?.activeTab === 'panel') scheduleRegion(RENDER_REGIONS.panel);
}

/**
 * Wire every render-affecting state event to the full or region scheduler.
 */
export function setupStateSubscriptions() {
	onStateChange(STATE_EVENTS.ACTIVE_DATASET, scheduleFullRefresh);
	onStateChange(STATE_EVENTS.DATASET_ADDED, scheduleFullRefresh);
	onStateChange(STATE_EVENTS.DATASET_REMOVED, scheduleFullRefresh);
	onStateChange(STATE_EVENTS.COLUMNS_UPDATED, onColumnsUpdated);
	onStateChange(STATE_EVENTS.CONFIG_UPDATED, onConfigUpdated);
	onStateChange(STATE_EVENTS.STATE_HYDRATED, scheduleFullRefresh);
	onStateChange(
		STATE_EVENTS.PREVIEW_ROWS_CHANGED,
		() => scheduleRegion(RENDER_REGIONS.workspace),
	);
}

/**
 * The active dataset's shown dataset, derived once per render pass.
 *
 * @private
 * @returns {ShownDataset | null} `null` when no dataset is active.
 */
function deriveActiveShownDataset() {
	const dataset = getActiveDataset();
	return dataset ? deriveShownDataset(dataset) : null;
}

/**
 * Re-render only active chart visualizations during a live control preview,
 * with the same inputs as the full render, tooltip filter actions included.
 * The controls sidebar and saved panel captures are deliberately untouched.
 */
export function livePreviewRender() {
	const shown = deriveActiveShownDataset();
	if (!shown) return;
	renderCharts(shown, updateDatasetConfig);
}

/**
 * @param {Dataset[]} datasets
 * @param {number} activeIndex
 */
function renderDatasetListView(datasets, activeIndex) {
	renderFileList(
		datasets,
		activeIndex,
		selectDataset,
		removeDatasetByIndex,
		handleJoinDatasetRequest,
		handlePresetDatasetRequest,
	);
}

function renderEmptyWorkspace() {
	renderEmptyState();
}

/**
 * @param {ShownDataset | null} shown
 * @param {number} previewRows
 */
function renderActiveDatasetWorkspace(shown, previewRows) {
	if (!shown) return;
	syncSidebarToTab(shown.dataset.chartConfig?.activeTab || 'preview');
	renderDatasetWorkspace(shown, {
		previewRows,
		onPreviewRowsChange: updatePreviewRows,
		onColumnSelectionChange: setActiveDatasetColumnSelection,
		onChartConfigChange: updateDatasetConfig,
	});
}

/**
 * @param {ShownDataset | null} shown
 */
function renderChartControlsView(shown) {
	if (!shown) return;
	renderChartControlsSidebar(shown);
}

/**
 * @param {{ withLayoutSelector?: boolean }} [options]
 */
function renderPanelWorkspace({ withLayoutSelector = true } = {}) {
	if (withLayoutSelector) renderLayoutSelector();
	renderSidebarPanel();
	renderCanvasPanel();
}

/**
 * Gather state through cheap getters and compose the full application view.
 * Call only through scheduleFullRefresh() or runFullRefreshNow().
 *
 * @private
 */
function refreshView() {
	const datasets = getLoadedDatasets();
	const activeIndex = getActiveDatasetIndex();
	const previewRows = getPreviewRows();

	renderDatasetListView(datasets, activeIndex);

	if (datasets.length === 0) {
		renderEmptyWorkspace();
		renderPanelWorkspace({ withLayoutSelector: false });
		return;
	}

	const shown = deriveActiveShownDataset();
	renderActiveDatasetWorkspace(shown, previewRows);
	renderChartControlsView(shown);
	renderPanelWorkspace();
}

/**
 * @param {string[]} columnNames
 */
export function setActiveDatasetColumnSelection(columnNames) {
	setStateColumnSelection(columnNames);
}

/**
 * @param {Object} config
 */
export function updateDatasetConfig(config) {
	updateActiveDatasetConfig(config);
}

/**
 * @param {number} rows
 */
function updatePreviewRows(rows) {
	try {
		setPreviewRows(rows);
	} catch {
		// Preserve the current preview state when the requested value is invalid.
	}
}
