/**
 * CHIVE render coordinator.
 *
 * Owns full and per-region render scheduling, render-affecting state
 * subscriptions, the application-level view composition, and the callbacks
 * that bridge dataset workspace views to state facades.
 *
 * @typedef {import('../types.js').Dataset} Dataset
 */

import {
	renderEmptyState,
	renderDatasetWorkspace,
	renderFileList,
} from '../features/datasetWorkspace/workspaceView.js';
import { renderCharts } from '../features/datasetWorkspace/views/chartsView.js';
import { renderChartControlsSidebar } from '../modules/chartControls/chartControlsManager.js';
import { getNumericColumns } from '../utils/columnHelpers.js';
import {
	getActiveDataset,
	getActiveDatasetIndex,
	getPreviewRows,
	onStateChange,
	STATE_EVENTS,
	setPreviewRows,
	updateActiveDatasetColumns,
	updateActiveDatasetConfig,
} from '../state/appState.js';
import {
	initializeLayoutSelector,
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
import { switchTab } from '../modules/uiManager.js';

// State events repaint through two coalescing entries that share one
// `fullQueued` guard, so "full wins": scheduleFullRefresh() repaints everything
// on the next microtask; scheduleRegion() drains a dirty-region set. The
// synchronous runFullRefreshNow() entry is reserved for boot and debugging.

const RENDER_REGIONS = Object.freeze({
	list: 'list',
	workspace: 'workspace',
	controls: 'controls',
	panel: 'panel',
});

const dirtyRegions = new Set();
let regionFlushQueued = false;
let fullQueued = false;

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
	if (fullQueued) return;
	dirtyRegions.add(region);
	if (regionFlushQueued) return;
	regionFlushQueued = true;
	Promise.resolve().then(() => {
		regionFlushQueued = false;
		if (fullQueued) {
			dirtyRegions.clear();
			return;
		}

		const regions = new Set(dirtyRegions);
		dirtyRegions.clear();
		try {
			if (regions.has(RENDER_REGIONS.list)) {
				renderDatasetListView(getLoadedDatasets(), getActiveDatasetIndex());
			}
			if (regions.has(RENDER_REGIONS.workspace)) {
				renderActiveDatasetWorkspace(getActiveDataset(), getPreviewRows());
			}
			if (regions.has(RENDER_REGIONS.controls)) {
				renderChartControlsView(getActiveDataset());
			}
			if (regions.has(RENDER_REGIONS.panel)) {
				renderPanelWorkspace();
			}
		} catch (err) {
			reportRefreshError(err);
		}
	});
}

/**
 * Schedule one coalesced full refresh on the next microtask. The full guard
 * remains set for the render so region work emitted during it is suppressed.
 */
export function scheduleFullRefresh() {
	if (fullQueued) return;
	fullQueued = true;
	dirtyRegions.clear();
	Promise.resolve().then(() => {
		try {
			refreshView();
		} catch (err) {
			reportRefreshError(err);
		} finally {
			dirtyRegions.clear();
			fullQueued = false;
		}
	});
}

/**
 * Run a full refresh synchronously with the same full-refresh protection.
 * Boot errors deliberately escape to the initializer's error boundary; debug
 * calls deliberately surface the throw in the console.
 */
export function runFullRefreshNow() {
	const wasFullQueued = fullQueued;
	fullQueued = true;
	dirtyRegions.clear();
	try {
		refreshView();
	} finally {
		dirtyRegions.clear();
		fullQueued = wasFullQueued;
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
 * Re-render only active chart visualizations during a live control preview.
 * The controls sidebar and frozen panel snapshots are deliberately untouched.
 */
export function livePreviewRender() {
	const dataset = getActiveDataset();
	if (!dataset || !Array.isArray(dataset.columns)) return;

	const columnNames = dataset.columns.map(column => column.name);
	const selectedNames = new Set(
		Array.isArray(dataset.selectedColumns)
			? dataset.selectedColumns
			: columnNames,
	);
	const visibleColumns = dataset.columns.filter(column => selectedNames.has(column.name));
	const visibleNumericColumns = getNumericColumns(visibleColumns);
	renderCharts(dataset.chartConfig, dataset.rows, visibleColumns, visibleNumericColumns);
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
 * @param {Dataset | null} dataset
 * @param {number} previewRows
 */
function renderActiveDatasetWorkspace(dataset, previewRows) {
	if (!dataset) return;
	renderDatasetWorkspace(
		dataset.rows,
		dataset.columns,
		dataset.name,
		dataset.sizeLabel,
		previewRows,
		updatePreviewRows,
		dataset.selectedColumns,
		updateDatasetColumns,
		dataset.chartConfig,
		updateDatasetConfig,
	);
}

/**
 * @param {Dataset | null} dataset
 */
function renderChartControlsView(dataset) {
	if (!dataset) return;
	renderChartControlsSidebar(dataset);
}

/**
 * @param {{ withLayoutSelector?: boolean }} [options]
 */
function renderPanelWorkspace({ withLayoutSelector = true } = {}) {
	if (withLayoutSelector) initializeLayoutSelector();
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
	const dataset = getActiveDataset();
	const previewRows = getPreviewRows();

	renderDatasetListView(datasets, activeIndex);

	if (datasets.length === 0) {
		renderEmptyWorkspace();
		renderPanelWorkspace({ withLayoutSelector: false });
		switchTab('preview');
		return;
	}

	renderActiveDatasetWorkspace(dataset, previewRows);
	renderChartControlsView(dataset);
	renderPanelWorkspace();
}

/**
 * @param {string[]} columns
 */
export function updateDatasetColumns(columns) {
	updateActiveDatasetColumns(columns);
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
