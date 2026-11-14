// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	renderEmptyState: vi.fn(),
	renderDatasetWorkspace: vi.fn(),
	renderFileList: vi.fn(),
	renderCharts: vi.fn(),
	renderChartControlsSidebar: vi.fn(),
	getActiveDataset: vi.fn(),
	getActiveDatasetIndex: vi.fn(),
	getPreviewRows: vi.fn(),
	onStateChange: vi.fn(),
	STATE_EVENTS: {
		ACTIVE_DATASET_CHANGED: 'active-dataset',
		DATASET_ADDED: 'dataset-added',
		DATASET_REMOVED: 'dataset-removed',
		COLUMN_SELECTION_CHANGED: 'columns-updated',
		DATASET_COLUMNS_CHANGED: 'dataset-columns-changed',
		DATASET_CONFIG_UPDATED: 'config-updated',
		STATE_HYDRATED: 'state-hydrated',
		PREVIEW_ROWS_CHANGED: 'preview-rows-changed',
	},
	setPreviewRows: vi.fn(),
	setActiveDatasetColumnSelection: vi.fn(),
	setDatasetColumnCurrency: vi.fn(),
	updateActiveDatasetConfig: vi.fn(),
	renderSidebarPanel: vi.fn(),
	renderCanvasPanel: vi.fn(),
	getLoadedDatasets: vi.fn(),
	selectDataset: vi.fn(),
	removeDatasetByIndex: vi.fn(),
	handleJoinDatasetRequest: vi.fn(),
	handleSampleDatasetRequest: vi.fn(),
	syncSidebarToTab: vi.fn(),
}));

vi.mock('../../src/features/datasetWorkspace/workspaceView.js', () => ({
	renderDatasetWorkspace: mocks.renderDatasetWorkspace,
}));

vi.mock('../../src/features/datasetWorkspace/views/fileListView.js', () => ({
	renderFileList: mocks.renderFileList,
}));

vi.mock('../../src/features/datasetWorkspace/views/emptyWorkspaceView.js', () => ({
	renderEmptyState: mocks.renderEmptyState,
}));

vi.mock('../../src/features/datasetWorkspace/views/chartsView.js', () => ({
	renderCharts: mocks.renderCharts,
}));

vi.mock('../../src/features/datasetWorkspace/chartControls/chartControlsController.js', () => ({
	renderChartControlsSidebar: mocks.renderChartControlsSidebar,
}));

vi.mock('../../src/state/appState.js', () => ({
	getActiveDataset: mocks.getActiveDataset,
	getActiveDatasetIndex: mocks.getActiveDatasetIndex,
	getPreviewRows: mocks.getPreviewRows,
	onStateChange: mocks.onStateChange,
	STATE_EVENTS: mocks.STATE_EVENTS,
	setPreviewRows: mocks.setPreviewRows,
	setActiveDatasetColumnSelection: mocks.setActiveDatasetColumnSelection,
	setDatasetColumnCurrency: mocks.setDatasetColumnCurrency,
	updateActiveDatasetConfig: mocks.updateActiveDatasetConfig,
}));

vi.mock('../../src/features/panel/panelController.js', () => ({
	renderSidebarPanel: mocks.renderSidebarPanel,
	renderCanvasPanel: mocks.renderCanvasPanel,
}));

vi.mock('../../src/features/datasetWorkspace/datasetController.js', () => ({
	getLoadedDatasets: mocks.getLoadedDatasets,
	selectDataset: mocks.selectDataset,
	removeDatasetByIndex: mocks.removeDatasetByIndex,
	handleJoinDatasetRequest: mocks.handleJoinDatasetRequest,
	handleSampleDatasetRequest: mocks.handleSampleDatasetRequest,
}));

vi.mock('../../src/app/uiManager.js', () => ({
	syncSidebarToTab: mocks.syncSidebarToTab,
}));

const baseDataset = {
	name: 'Data.csv',
	sizeLabel: '2 KB',
	rows: [
		{ region: 'North', value: 10 },
		{ region: 'South', value: 20 },
	],
	columns: [
		{ name: 'region', type: 'text' },
		{ name: 'value', type: 'number' },
	],
	selectedColumns: ['value'],
	chartConfig: { activeTab: 'preview', bar: { enabled: true } },
};

function setActiveDataset() {
	mocks.getLoadedDatasets.mockReturnValue([baseDataset]);
	mocks.getActiveDataset.mockReturnValue(baseDataset);
	mocks.getActiveDatasetIndex.mockReturnValue(0);
	mocks.getPreviewRows.mockReturnValue(25);
}

function stateCallbacks() {
	return Object.fromEntries(
		mocks.onStateChange.mock.calls.map(([event, callback]) => [event, callback]),
	);
}

async function importCoordinator() {
	return import('../../src/app/renderCoordinator.js');
}

let frames;
let nextFrameId;

function flushFrame() {
	const pending = [...frames.values()];
	frames.clear();
	pending.forEach(callback => callback(16));
}

beforeEach(() => {
	vi.restoreAllMocks();
	vi.resetModules();
	vi.clearAllMocks();
	mocks.getActiveDataset.mockReturnValue(null);
	mocks.getActiveDatasetIndex.mockReturnValue(-1);
	mocks.getPreviewRows.mockReturnValue(10);
	mocks.getLoadedDatasets.mockReturnValue([]);
	frames = new Map();
	nextFrameId = 1;
	vi.stubGlobal('requestAnimationFrame', vi.fn(callback => {
		const id = nextFrameId++;
		frames.set(id, callback);
		return id;
	}));
	vi.stubGlobal('cancelAnimationFrame', vi.fn(id => frames.delete(id)));
});

describe('renderCoordinator', () => {
	it('renders the empty application path synchronously', async () => {
		const coordinator = await importCoordinator();

		coordinator.runFullRefreshNow();

		expect(mocks.renderFileList).toHaveBeenCalledWith(
			[],
			-1,
			mocks.selectDataset,
			mocks.removeDatasetByIndex,
			mocks.handleJoinDatasetRequest,
			mocks.handleSampleDatasetRequest,
		);
		expect(mocks.renderEmptyState).toHaveBeenCalledTimes(1);
		expect(mocks.renderSidebarPanel).toHaveBeenCalledTimes(1);
		expect(mocks.renderCanvasPanel).toHaveBeenCalledTimes(1);
		expect(mocks.syncSidebarToTab).not.toHaveBeenCalled();
	});

	it('draws live previews from the shown dataset, hidden columns included, with the tooltip filter callback', async () => {
		const dataset = {
			...baseDataset,
			chartConfig: {
				...baseDataset.chartConfig,
				globalFilter: {
					rules: [{ column: 'region', mode: 'categorical', include: ['v:North'], exclude: [] }],
					combine: 'AND',
				},
			},
		};
		mocks.getActiveDataset.mockReturnValue(dataset);
		const coordinator = await importCoordinator();

		coordinator.livePreviewRender();

		expect(mocks.renderCharts).toHaveBeenCalledTimes(1);
		const [shown, onDatasetConfigChange] = mocks.renderCharts.mock.calls[0];
		expect(shown.dataset).toBe(dataset);
		expect(shown.rows).toEqual([{ region: 'North', value: 10 }]);
		expect(shown.visibleColumns).toEqual([{ name: 'value', type: 'number' }]);
		expect(shown.columnTypeByName).toEqual({ region: 'text', value: 'number' });
		// The same callback the full render hands the workspace, so tooltips
		// pinned during a live preview keep their filter actions.
		expect(onDatasetConfigChange).toBe(coordinator.updateDatasetConfig);
	});

	it('skips a live preview without an active dataset', async () => {
		const coordinator = await importCoordinator();

		coordinator.livePreviewRender();

		expect(mocks.renderCharts).not.toHaveBeenCalled();
	});

	it('renders the active dataset from one shown dataset and bridges the workspace callbacks', async () => {
		setActiveDataset();
		const coordinator = await importCoordinator();

		coordinator.runFullRefreshNow();

		expect(mocks.renderDatasetWorkspace).toHaveBeenCalledTimes(1);
		const [shown, options] = mocks.renderDatasetWorkspace.mock.calls[0];
		expect(shown.dataset).toBe(baseDataset);
		expect(shown.rows).toBe(baseDataset.rows);
		expect(shown.visibleColumns).toEqual([{ name: 'value', type: 'number' }]);
		expect(options).toEqual({
			previewRows: 25,
			onPreviewRowsChange: expect.any(Function),
			onColumnSelectionChange: coordinator.setActiveDatasetColumnSelection,
			onDatasetConfigChange: coordinator.updateDatasetConfig,
			onColumnCurrencyChange: expect.any(Function),
		});
		// The controls sidebar reads the value the workspace drew from.
		expect(mocks.renderChartControlsSidebar).toHaveBeenCalledTimes(1);
		expect(mocks.renderChartControlsSidebar.mock.calls[0][0]).toBe(shown);

		options.onPreviewRowsChange(50);
		options.onColumnSelectionChange(['value']);
		options.onDatasetConfigChange({ activeTab: 'charts' });
		expect(mocks.setPreviewRows).toHaveBeenCalledWith(50);
		expect(mocks.setActiveDatasetColumnSelection).toHaveBeenCalledWith(['value']);
		expect(mocks.updateActiveDatasetConfig).toHaveBeenCalledWith({ activeTab: 'charts' });

		mocks.setPreviewRows.mockImplementationOnce(() => {
			throw new Error('invalid');
		});
		expect(() => options.onPreviewRowsChange(0)).not.toThrow();
	});

	it('wires the render-affecting state events', async () => {
		const coordinator = await importCoordinator();

		coordinator.setupStateSubscriptions();

		expect(mocks.onStateChange).toHaveBeenCalledTimes(8);
		expect(mocks.onStateChange.mock.calls.map(([event]) => event)).toEqual([
			mocks.STATE_EVENTS.ACTIVE_DATASET_CHANGED,
			mocks.STATE_EVENTS.DATASET_ADDED,
			mocks.STATE_EVENTS.DATASET_REMOVED,
			mocks.STATE_EVENTS.COLUMN_SELECTION_CHANGED,
			mocks.STATE_EVENTS.DATASET_COLUMNS_CHANGED,
			mocks.STATE_EVENTS.DATASET_CONFIG_UPDATED,
			mocks.STATE_EVENTS.STATE_HYDRATED,
			mocks.STATE_EVENTS.PREVIEW_ROWS_CHANGED,
		]);
	});

	it('coalesces synchronous full-refresh events into one animation frame', async () => {
		const coordinator = await importCoordinator();
		coordinator.setupStateSubscriptions();
		const callbacks = stateCallbacks();

		callbacks[mocks.STATE_EVENTS.DATASET_ADDED]();
		callbacks[mocks.STATE_EVENTS.ACTIVE_DATASET_CHANGED]();
		expect(mocks.renderFileList).not.toHaveBeenCalled();

		flushFrame();
		expect(mocks.renderFileList).toHaveBeenCalledTimes(1);
	});

	it('reports a scheduled render error and accepts later refreshes', async () => {
		const coordinator = await importCoordinator();
		coordinator.setupStateSubscriptions();
		const callbacks = stateCallbacks();
		const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

		mocks.renderFileList.mockImplementationOnce(() => {
			throw new Error('render boom');
		});
		callbacks[mocks.STATE_EVENTS.ACTIVE_DATASET_CHANGED]();
		flushFrame();
		expect(dispatchSpy).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'chive-internal-error' }),
		);
		const { getErrorLog } = await import('../../src/services/diagnostics.js');
		expect(getErrorLog().at(-1)).toMatchObject({
			type: 'refresh-error', message: 'render boom', stack: expect.stringContaining('render boom'),
		});

		mocks.renderFileList.mockClear();
		callbacks[mocks.STATE_EVENTS.DATASET_ADDED]();
		flushFrame();
		expect(mocks.renderFileList).toHaveBeenCalledTimes(1);
	});

	it('routes columns and preview-row events to their narrow regions', async () => {
		setActiveDataset();
		const coordinator = await importCoordinator();
		coordinator.setupStateSubscriptions();
		const callbacks = stateCallbacks();

		callbacks[mocks.STATE_EVENTS.COLUMN_SELECTION_CHANGED]();
		flushFrame();
		expect(mocks.renderDatasetWorkspace).toHaveBeenCalledTimes(1);
		expect(mocks.renderChartControlsSidebar).toHaveBeenCalledTimes(1);
		expect(mocks.renderFileList).not.toHaveBeenCalled();
		expect(mocks.renderCanvasPanel).not.toHaveBeenCalled();

		mocks.renderDatasetWorkspace.mockClear();
		mocks.renderChartControlsSidebar.mockClear();
		mocks.getPreviewRows.mockReturnValue(40);
		callbacks[mocks.STATE_EVENTS.PREVIEW_ROWS_CHANGED]();
		flushFrame();
		expect(mocks.renderDatasetWorkspace).toHaveBeenCalledTimes(1);
		expect(mocks.renderDatasetWorkspace.mock.calls[0][1].previewRows).toBe(40);
		expect(mocks.renderChartControlsSidebar).not.toHaveBeenCalled();
		expect(mocks.renderCanvasPanel).not.toHaveBeenCalled();
	});

	it('routes DATASET_CONFIG_UPDATED by payload and renders the workspace before the panel', async () => {
		setActiveDataset();
		const coordinator = await importCoordinator();
		coordinator.setupStateSubscriptions();
		const callbacks = stateCallbacks();

		callbacks[mocks.STATE_EVENTS.DATASET_CONFIG_UPDATED]({ bar: { enabled: true } });
		flushFrame();
		expect(mocks.renderDatasetWorkspace).toHaveBeenCalledTimes(1);
		expect(mocks.renderChartControlsSidebar).toHaveBeenCalledTimes(1);
		expect(mocks.renderCanvasPanel).not.toHaveBeenCalled();
		// One shown dataset per flush: the controls read the value the workspace drew from.
		const [shown] = mocks.renderDatasetWorkspace.mock.calls[0];
		expect(shown.dataset).toBe(baseDataset);
		expect(mocks.renderChartControlsSidebar.mock.calls[0][0]).toBe(shown);

		mocks.renderDatasetWorkspace.mockClear();
		mocks.renderCanvasPanel.mockClear();
		callbacks[mocks.STATE_EVENTS.DATASET_CONFIG_UPDATED]({ activeTab: 'panel' });
		flushFrame();
		expect(mocks.renderDatasetWorkspace).toHaveBeenCalledTimes(1);
		expect(mocks.renderCanvasPanel).toHaveBeenCalledTimes(1);
		expect(mocks.renderDatasetWorkspace.mock.invocationCallOrder[0])
			.toBeLessThan(mocks.renderCanvasPanel.mock.invocationCallOrder[0]);
	});

	it('lets a full refresh subsume narrow work in either scheduling order', async () => {
		setActiveDataset();
		const coordinator = await importCoordinator();
		coordinator.setupStateSubscriptions();
		const callbacks = stateCallbacks();

		callbacks[mocks.STATE_EVENTS.COLUMN_SELECTION_CHANGED]();
		callbacks[mocks.STATE_EVENTS.ACTIVE_DATASET_CHANGED]();
		flushFrame();
		expect(mocks.renderFileList).toHaveBeenCalledTimes(1);
		expect(mocks.renderDatasetWorkspace).toHaveBeenCalledTimes(1);

		mocks.renderFileList.mockClear();
		mocks.renderDatasetWorkspace.mockClear();
		callbacks[mocks.STATE_EVENTS.ACTIVE_DATASET_CHANGED]();
		callbacks[mocks.STATE_EVENTS.COLUMN_SELECTION_CHANGED]();
		flushFrame();
		expect(mocks.renderFileList).toHaveBeenCalledTimes(1);
		expect(mocks.renderDatasetWorkspace).toHaveBeenCalledTimes(1);
	});

	it('suppresses region work emitted during a full refresh', async () => {
		setActiveDataset();
		const coordinator = await importCoordinator();
		coordinator.setupStateSubscriptions();
		const callbacks = stateCallbacks();

		mocks.renderDatasetWorkspace.mockImplementationOnce(() => {
			callbacks[mocks.STATE_EVENTS.DATASET_CONFIG_UPDATED]({ globalFilter: { rules: [] } });
		});
		callbacks[mocks.STATE_EVENTS.ACTIVE_DATASET_CHANGED]();
		flushFrame();
		flushFrame();

		expect(mocks.renderDatasetWorkspace).toHaveBeenCalledTimes(1);
	});
});
