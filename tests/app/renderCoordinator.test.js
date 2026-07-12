// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	renderEmptyState: vi.fn(),
	renderDataInterface: vi.fn(),
	renderFileList: vi.fn(),
	renderCharts: vi.fn(),
	renderChartControlsSidebar: vi.fn(),
	getNumericColumns: vi.fn(),
	getActiveDataset: vi.fn(),
	getActiveDatasetIndex: vi.fn(),
	getPreviewRows: vi.fn(),
	onStateChange: vi.fn(),
	STATE_EVENTS: {
		ACTIVE_DATASET: 'active-dataset',
		DATASET_ADDED: 'dataset-added',
		DATASET_REMOVED: 'dataset-removed',
		COLUMNS_UPDATED: 'columns-updated',
		CONFIG_UPDATED: 'config-updated',
		STATE_HYDRATED: 'state-hydrated',
		PREVIEW_ROWS_CHANGED: 'preview-rows-changed',
	},
	setPreviewRows: vi.fn(),
	updateActiveDatasetColumns: vi.fn(),
	updateActiveDatasetConfig: vi.fn(),
	initializeLayoutSelector: vi.fn(),
	renderSidebarPanel: vi.fn(),
	renderCanvasPanel: vi.fn(),
	getLoadedDatasets: vi.fn(),
	selectDataset: vi.fn(),
	removeDatasetByIndex: vi.fn(),
	handleJoinDatasetRequest: vi.fn(),
	handlePresetDatasetRequest: vi.fn(),
	switchTab: vi.fn(),
}));

vi.mock('../../src/components/datasetWorkspace/datasetWorkspaceView.js', () => ({
	renderEmptyState: mocks.renderEmptyState,
	renderDataInterface: mocks.renderDataInterface,
	renderFileList: mocks.renderFileList,
}));

vi.mock('../../src/components/datasetWorkspace/chartsView.js', () => ({
	renderCharts: mocks.renderCharts,
}));

vi.mock('../../src/modules/chartControls/chartControlsManager.js', () => ({
	renderChartControlsSidebar: mocks.renderChartControlsSidebar,
}));

vi.mock('../../src/utils/columnHelpers.js', () => ({
	getNumericColumns: mocks.getNumericColumns,
}));

vi.mock('../../src/modules/state/appState.js', () => ({
	getActiveDataset: mocks.getActiveDataset,
	getActiveDatasetIndex: mocks.getActiveDatasetIndex,
	getPreviewRows: mocks.getPreviewRows,
	onStateChange: mocks.onStateChange,
	STATE_EVENTS: mocks.STATE_EVENTS,
	setPreviewRows: mocks.setPreviewRows,
	updateActiveDatasetColumns: mocks.updateActiveDatasetColumns,
	updateActiveDatasetConfig: mocks.updateActiveDatasetConfig,
}));

vi.mock('../../src/features/panel/panelController.js', () => ({
	initializeLayoutSelector: mocks.initializeLayoutSelector,
	renderSidebarPanel: mocks.renderSidebarPanel,
	renderCanvasPanel: mocks.renderCanvasPanel,
}));

vi.mock('../../src/modules/fileManager.js', () => ({
	getLoadedDatasets: mocks.getLoadedDatasets,
	selectDataset: mocks.selectDataset,
	removeDatasetByIndex: mocks.removeDatasetByIndex,
	handleJoinDatasetRequest: mocks.handleJoinDatasetRequest,
	handlePresetDatasetRequest: mocks.handlePresetDatasetRequest,
}));

vi.mock('../../src/modules/uiManager.js', () => ({
	switchTab: mocks.switchTab,
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

beforeEach(() => {
	vi.restoreAllMocks();
	vi.resetModules();
	vi.clearAllMocks();
	mocks.getNumericColumns.mockImplementation(
		columns => columns.filter(column => column.type === 'number'),
	);
	mocks.getActiveDataset.mockReturnValue(null);
	mocks.getActiveDatasetIndex.mockReturnValue(-1);
	mocks.getPreviewRows.mockReturnValue(10);
	mocks.getLoadedDatasets.mockReturnValue([]);
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
			mocks.handlePresetDatasetRequest,
		);
		expect(mocks.renderEmptyState).toHaveBeenCalledTimes(1);
		expect(mocks.initializeLayoutSelector).not.toHaveBeenCalled();
		expect(mocks.renderSidebarPanel).toHaveBeenCalledTimes(1);
		expect(mocks.renderCanvasPanel).toHaveBeenCalledTimes(1);
		expect(mocks.switchTab).toHaveBeenCalledWith('preview');
	});

	it('renders the active dataset and bridges workspace and live-preview callbacks', async () => {
		setActiveDataset();
		const coordinator = await importCoordinator();

		coordinator.runFullRefreshNow();

		expect(mocks.renderDataInterface).toHaveBeenCalledWith(
			baseDataset.rows,
			baseDataset.columns,
			baseDataset.name,
			baseDataset.sizeLabel,
			25,
			expect.any(Function),
			baseDataset.selectedColumns,
			expect.any(Function),
			baseDataset.chartConfig,
			expect.any(Function),
		);
		expect(mocks.renderChartControlsSidebar).toHaveBeenCalledWith(baseDataset);
		expect(mocks.initializeLayoutSelector).toHaveBeenCalledTimes(1);

		coordinator.livePreviewRender();
		expect(mocks.renderCharts).toHaveBeenCalledWith(
			baseDataset.chartConfig,
			baseDataset.rows,
			[{ name: 'value', type: 'number' }],
			[{ name: 'value', type: 'number' }],
		);

		const renderArgs = mocks.renderDataInterface.mock.calls[0];
		renderArgs[5](50);
		renderArgs[7](['value']);
		renderArgs[9]({ activeTab: 'charts' });
		expect(mocks.setPreviewRows).toHaveBeenCalledWith(50);
		expect(mocks.updateActiveDatasetColumns).toHaveBeenCalledWith(['value']);
		expect(mocks.updateActiveDatasetConfig).toHaveBeenCalledWith({ activeTab: 'charts' });

		mocks.setPreviewRows.mockImplementationOnce(() => {
			throw new Error('invalid');
		});
		expect(() => renderArgs[5](0)).not.toThrow();
	});

	it('wires the seven render-affecting state events', async () => {
		const coordinator = await importCoordinator();

		coordinator.setupStateSubscriptions();

		expect(mocks.onStateChange).toHaveBeenCalledTimes(7);
		expect(mocks.onStateChange.mock.calls.map(([event]) => event)).toEqual([
			mocks.STATE_EVENTS.ACTIVE_DATASET,
			mocks.STATE_EVENTS.DATASET_ADDED,
			mocks.STATE_EVENTS.DATASET_REMOVED,
			mocks.STATE_EVENTS.COLUMNS_UPDATED,
			mocks.STATE_EVENTS.CONFIG_UPDATED,
			mocks.STATE_EVENTS.STATE_HYDRATED,
			mocks.STATE_EVENTS.PREVIEW_ROWS_CHANGED,
		]);
	});

	it('coalesces synchronous full-refresh events', async () => {
		const coordinator = await importCoordinator();
		coordinator.setupStateSubscriptions();
		const callbacks = stateCallbacks();

		callbacks[mocks.STATE_EVENTS.DATASET_ADDED]();
		callbacks[mocks.STATE_EVENTS.ACTIVE_DATASET]();
		expect(mocks.renderFileList).not.toHaveBeenCalled();

		await Promise.resolve();
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
		callbacks[mocks.STATE_EVENTS.ACTIVE_DATASET]();
		await Promise.resolve();
		expect(dispatchSpy).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'chive-internal-error' }),
		);

		mocks.renderFileList.mockClear();
		callbacks[mocks.STATE_EVENTS.DATASET_ADDED]();
		await Promise.resolve();
		expect(mocks.renderFileList).toHaveBeenCalledTimes(1);
	});

	it('routes columns and preview-row events to their narrow regions', async () => {
		setActiveDataset();
		const coordinator = await importCoordinator();
		coordinator.setupStateSubscriptions();
		const callbacks = stateCallbacks();

		callbacks[mocks.STATE_EVENTS.COLUMNS_UPDATED]();
		await Promise.resolve();
		expect(mocks.renderDataInterface).toHaveBeenCalledTimes(1);
		expect(mocks.renderChartControlsSidebar).toHaveBeenCalledTimes(1);
		expect(mocks.renderFileList).not.toHaveBeenCalled();
		expect(mocks.renderCanvasPanel).not.toHaveBeenCalled();

		mocks.renderDataInterface.mockClear();
		mocks.renderChartControlsSidebar.mockClear();
		mocks.getPreviewRows.mockReturnValue(40);
		callbacks[mocks.STATE_EVENTS.PREVIEW_ROWS_CHANGED]();
		await Promise.resolve();
		expect(mocks.renderDataInterface).toHaveBeenCalledTimes(1);
		expect(mocks.renderDataInterface.mock.calls[0][4]).toBe(40);
		expect(mocks.renderChartControlsSidebar).not.toHaveBeenCalled();
		expect(mocks.renderCanvasPanel).not.toHaveBeenCalled();
	});

	it('routes CONFIG_UPDATED by payload and renders the workspace before the panel', async () => {
		setActiveDataset();
		const coordinator = await importCoordinator();
		coordinator.setupStateSubscriptions();
		const callbacks = stateCallbacks();

		callbacks[mocks.STATE_EVENTS.CONFIG_UPDATED]({ bar: { enabled: true } });
		await Promise.resolve();
		expect(mocks.renderDataInterface).toHaveBeenCalledTimes(1);
		expect(mocks.renderChartControlsSidebar).toHaveBeenCalledTimes(1);
		expect(mocks.renderCanvasPanel).not.toHaveBeenCalled();

		mocks.renderDataInterface.mockClear();
		mocks.renderCanvasPanel.mockClear();
		callbacks[mocks.STATE_EVENTS.CONFIG_UPDATED]({ activeTab: 'panel' });
		await Promise.resolve();
		expect(mocks.renderDataInterface).toHaveBeenCalledTimes(1);
		expect(mocks.renderCanvasPanel).toHaveBeenCalledTimes(1);
		expect(mocks.renderDataInterface.mock.invocationCallOrder[0])
			.toBeLessThan(mocks.renderCanvasPanel.mock.invocationCallOrder[0]);
	});

	it('lets a full refresh subsume narrow work in either scheduling order', async () => {
		setActiveDataset();
		const coordinator = await importCoordinator();
		coordinator.setupStateSubscriptions();
		const callbacks = stateCallbacks();

		callbacks[mocks.STATE_EVENTS.COLUMNS_UPDATED]();
		callbacks[mocks.STATE_EVENTS.ACTIVE_DATASET]();
		await Promise.resolve();
		expect(mocks.renderFileList).toHaveBeenCalledTimes(1);
		expect(mocks.renderDataInterface).toHaveBeenCalledTimes(1);

		mocks.renderFileList.mockClear();
		mocks.renderDataInterface.mockClear();
		callbacks[mocks.STATE_EVENTS.ACTIVE_DATASET]();
		callbacks[mocks.STATE_EVENTS.COLUMNS_UPDATED]();
		await Promise.resolve();
		expect(mocks.renderFileList).toHaveBeenCalledTimes(1);
		expect(mocks.renderDataInterface).toHaveBeenCalledTimes(1);
	});

	it('suppresses region work emitted during a full refresh', async () => {
		setActiveDataset();
		const coordinator = await importCoordinator();
		coordinator.setupStateSubscriptions();
		const callbacks = stateCallbacks();

		mocks.renderDataInterface.mockImplementationOnce(() => {
			callbacks[mocks.STATE_EVENTS.CONFIG_UPDATED]({ globalFilter: { rules: [] } });
		});
		callbacks[mocks.STATE_EVENTS.ACTIVE_DATASET]();
		await Promise.resolve();
		await Promise.resolve();

		expect(mocks.renderDataInterface).toHaveBeenCalledTimes(1);
	});
});
