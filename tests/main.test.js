// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	initializeI18n: vi.fn(),
	t: vi.fn(),
	isPersistenceAvailable: vi.fn(),
	hydrateState: vi.fn(),
	enablePersistenceAutoSave: vi.fn(),
	getPersistenceErrorMessageKey: vi.fn(),
	renderEmptyState: vi.fn(),
	renderDataInterface: vi.fn(),
	renderFileList: vi.fn(),
	initChartControls: vi.fn(),
	renderChartControlsSidebar: vi.fn(),
	renderCharts: vi.fn(),
	mergeChartConfigWithDefaults: vi.fn(),
	getNumericColumns: vi.fn(),
	rehydratePanelChartSpecs: vi.fn(),
	throttle: vi.fn(),
	getState: vi.fn(),
	getPersistenceSnapshot: vi.fn(),
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
	normalizeActiveDatasetConfig: vi.fn(),
	updateActiveDatasetColumns: vi.fn(),
	updateActiveDatasetConfig: vi.fn(),
	replaceAllState: vi.fn(),
	initPanelManager: vi.fn(),
	initializeLayoutSelector: vi.fn(),
	renderSidebarPanel: vi.fn(),
	renderCanvasPanel: vi.fn(),
	initFileManager: vi.fn(),
	getLoadedDatasets: vi.fn(),
	selectDataset: vi.fn(),
	removeDatasetByIndex: vi.fn(),
	handleJoinDatasetRequest: vi.fn(),
	handlePresetDatasetRequest: vi.fn(),
	initializeAllEventHandlers: vi.fn(),
	showFeedback: vi.fn(),
	showFeedbackMessage: vi.fn(),
	showError: vi.fn(),
	showErrorMessage: vi.fn(),
	switchTab: vi.fn(),
	enableStateLog: vi.fn(),
	disableStateLog: vi.fn(),
	getStateLog: vi.fn(),
	clearStateLog: vi.fn(),
	getStateSummary: vi.fn(),
}));

vi.mock('../src/services/i18nService.js', () => ({
	initializeI18n: mocks.initializeI18n,
	t: mocks.t,
}));

vi.mock('../src/services/persistenceService.js', () => ({
	isPersistenceAvailable: mocks.isPersistenceAvailable,
	hydrateState: mocks.hydrateState,
	enablePersistenceAutoSave: mocks.enablePersistenceAutoSave,
	getPersistenceErrorMessageKey: mocks.getPersistenceErrorMessageKey,
}));


vi.mock('../src/components/resultsView.js', () => ({
	renderEmptyState: mocks.renderEmptyState,
	renderDataInterface: mocks.renderDataInterface,
	renderFileList: mocks.renderFileList,
}));

vi.mock('../src/features/chartFeatures.js', () => ({
	initChartControls: mocks.initChartControls,
	renderChartControlsSidebar: mocks.renderChartControlsSidebar,
	renderCharts: mocks.renderCharts,
}));

vi.mock('../src/config/chartDefaults.js', () => ({
	mergeChartConfigWithDefaults: mocks.mergeChartConfigWithDefaults,
}));

vi.mock('../src/utils/columnHelpers.js', () => ({
	getNumericColumns: mocks.getNumericColumns,
}));

vi.mock('../src/utils/panelHydration.js', () => ({
	rehydratePanelChartSpecs: mocks.rehydratePanelChartSpecs,
}));

vi.mock('../src/utils/throttle.js', () => ({
	throttle: mocks.throttle,
}));

vi.mock('../src/modules/state/appState.js', () => ({
	getState: mocks.getState,
	getPersistenceSnapshot: mocks.getPersistenceSnapshot,
	getActiveDataset: mocks.getActiveDataset,
	getActiveDatasetIndex: mocks.getActiveDatasetIndex,
	getPreviewRows: mocks.getPreviewRows,
	onStateChange: mocks.onStateChange,
	STATE_EVENTS: mocks.STATE_EVENTS,
	setPreviewRows: mocks.setPreviewRows,
	normalizeActiveDatasetConfig: mocks.normalizeActiveDatasetConfig,
	updateActiveDatasetColumns: mocks.updateActiveDatasetColumns,
	updateActiveDatasetConfig: mocks.updateActiveDatasetConfig,
	replaceAllState: mocks.replaceAllState,
}));

vi.mock('../src/modules/panelManager.js', () => ({
	initPanelManager: mocks.initPanelManager,
	initializeLayoutSelector: mocks.initializeLayoutSelector,
	renderSidebarPanel: mocks.renderSidebarPanel,
	renderCanvasPanel: mocks.renderCanvasPanel,
}));

vi.mock('../src/modules/fileManager.js', () => ({
	initFileManager: mocks.initFileManager,
	getLoadedDatasets: mocks.getLoadedDatasets,
	selectDataset: mocks.selectDataset,
	removeDatasetByIndex: mocks.removeDatasetByIndex,
	handleJoinDatasetRequest: mocks.handleJoinDatasetRequest,
	handlePresetDatasetRequest: mocks.handlePresetDatasetRequest,
}));

vi.mock('../src/modules/eventHandlers.js', () => ({
	initializeAllEventHandlers: mocks.initializeAllEventHandlers,
}));

vi.mock('../src/modules/feedbackUI.js', () => ({
	showFeedback: mocks.showFeedback,
	showFeedbackMessage: mocks.showFeedbackMessage,
	showError: mocks.showError,
	showErrorMessage: mocks.showErrorMessage,
}));

vi.mock('../src/modules/uiManager.js', () => ({
	switchTab: mocks.switchTab,
}));

vi.mock('../src/modules/state/stateEvents.js', () => ({
	enableStateLog: mocks.enableStateLog,
	disableStateLog: mocks.disableStateLog,
	getStateLog: mocks.getStateLog,
	clearStateLog: mocks.clearStateLog,
}));

vi.mock('../src/modules/state/stateDebug.js', () => ({
	getStateSummary: mocks.getStateSummary,
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

function resetDefaults() {
	vi.resetModules();
	vi.clearAllMocks();
	document.body.innerHTML = '';
	document.body.style.visibility = '';
	delete window.chiveDebug;
	Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' });

	mocks.initializeI18n.mockResolvedValue(undefined);
	mocks.t.mockImplementation((key, args) => {
		if (Array.isArray(args)) return `${key}:${args.join(',')}`;
		if (args !== undefined) return `${key}:${args}`;
		return key;
	});
	mocks.isPersistenceAvailable.mockReturnValue(true);
	mocks.hydrateState.mockResolvedValue(undefined);
	mocks.getPersistenceErrorMessageKey.mockReturnValue('chive-persistence-error');
	mocks.mergeChartConfigWithDefaults.mockImplementation(config => config);
	mocks.getNumericColumns.mockImplementation(columns => columns.filter(column => column.type === 'number'));
	mocks.throttle.mockImplementation(fn => fn);
	mocks.getState.mockReturnValue({ data: { activeIndex: -1 }, ui: { previewRows: 10 } });
	mocks.getPersistenceSnapshot.mockReturnValue({ snapshot: true });
	mocks.getActiveDataset.mockReturnValue(null);
	mocks.getActiveDatasetIndex.mockReturnValue(-1);
	mocks.getPreviewRows.mockReturnValue(10);
	mocks.getLoadedDatasets.mockReturnValue([]);
}

async function importMain() {
	await import('../src/main.js');
	for (let i = 0; i < 8; i += 1) {
		await Promise.resolve();
	}
}

describe('main.js bootstrap', () => {
	let windowListeners;

	beforeEach(() => {
		resetDefaults();
		windowListeners = new Map();
		vi.spyOn(window, 'addEventListener').mockImplementation((type, listener) => {
			windowListeners.set(type, listener);
		});
	});

	it('initializes i18n only and skips app wiring on non-app pages', async () => {
		await importMain();

		expect(mocks.initializeI18n).toHaveBeenCalledTimes(1);
		expect(mocks.hydrateState).not.toHaveBeenCalled();
		expect(mocks.initFileManager).not.toHaveBeenCalled();
		expect(mocks.initializeAllEventHandlers).not.toHaveBeenCalled();
		expect(window.chiveDebug).toEqual(expect.objectContaining({
			getState: mocks.getState,
			switchTab: mocks.switchTab,
			showFeedback: mocks.showFeedbackMessage,
			showError: mocks.showErrorMessage,
		}));
	});

	it('hydrates, wires modules, renders empty state, and installs error listeners on app pages', async () => {
		document.body.innerHTML = '<div id="file-info"></div>';

		await importMain();

		expect(mocks.hydrateState).toHaveBeenCalledWith({
			replaceAllState: mocks.replaceAllState,
			transformPanel: mocks.rehydratePanelChartSpecs,
		});
		expect(mocks.initFileManager).toHaveBeenCalledWith();
		expect(mocks.initChartControls).toHaveBeenCalledWith(null, expect.any(Function));
		expect(mocks.initPanelManager).toHaveBeenCalledWith(mocks.showFeedback);
		expect(mocks.initializeAllEventHandlers).toHaveBeenCalledTimes(1);
		expect(mocks.onStateChange).toHaveBeenCalledTimes(7);
		expect(mocks.enablePersistenceAutoSave).toHaveBeenCalledWith(
			mocks.getPersistenceSnapshot,
			{ onSaveError: expect.any(Function) },
		);
		expect(mocks.renderFileList).toHaveBeenCalledWith(
			[],
			-1,
			mocks.selectDataset,
			mocks.removeDatasetByIndex,
			mocks.handleJoinDatasetRequest,
			mocks.handlePresetDatasetRequest,
		);
		expect(mocks.renderEmptyState).toHaveBeenCalledTimes(1);
		expect(mocks.switchTab).toHaveBeenCalledWith('preview');

		mocks.enablePersistenceAutoSave.mock.calls[0][1].onSaveError(new Error('db'));
		expect(mocks.showError).toHaveBeenCalledWith('chive-persistence-error');

		// Locale changes now route through scheduleFullRefresh, so the re-render
		// lands on the next microtask rather than synchronously.
		windowListeners.get('chive-locale-changed')();
		await Promise.resolve();
		expect(mocks.renderEmptyState).toHaveBeenCalledTimes(2);

		windowListeners.get('chive-internal-error')({ detail: { message: 'boom' } });
		windowListeners.get('chive-internal-error')({});
		expect(mocks.showError).toHaveBeenCalledWith('boom');
		expect(mocks.showError).toHaveBeenCalledWith('chive-error-internal');
	});

	it('renders the active dataset path and exposes debug callbacks', async () => {
		document.body.innerHTML = '<div id="file-info"></div>';
		mocks.getState.mockReturnValue({ data: { activeIndex: 0 }, ui: { previewRows: 25 } });
		mocks.getLoadedDatasets.mockReturnValue([baseDataset]);
		mocks.getActiveDataset.mockReturnValue(baseDataset);

		await importMain();

		expect(mocks.renderFileList).toHaveBeenCalledWith(
			[baseDataset],
			0,
			mocks.selectDataset,
			mocks.removeDatasetByIndex,
			mocks.handleJoinDatasetRequest,
			mocks.handlePresetDatasetRequest,
		);
		expect(mocks.normalizeActiveDatasetConfig).toHaveBeenCalledWith(mocks.mergeChartConfigWithDefaults);
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

		const livePreview = mocks.initChartControls.mock.calls[0][1];
		livePreview();
		expect(mocks.renderCharts).toHaveBeenCalledWith(
			baseDataset.chartConfig,
			baseDataset.rows,
			[{ name: 'value', type: 'number' }],
			[{ name: 'value', type: 'number' }],
		);

		const previewRowsCallback = mocks.renderDataInterface.mock.calls[0][5];
		previewRowsCallback(50);
		expect(mocks.setPreviewRows).toHaveBeenCalledWith(50);

		mocks.setPreviewRows.mockImplementationOnce(() => {
			throw new Error('invalid');
		});
		expect(() => previewRowsCallback(0)).not.toThrow();

		window.chiveDebug.updateDatasetColumns(['value']);
		window.chiveDebug.updateDatasetConfig({ activeTab: 'charts' });
		expect(mocks.updateActiveDatasetColumns).toHaveBeenCalledWith(['value']);
		expect(mocks.updateActiveDatasetConfig).toHaveBeenCalledWith({ activeTab: 'charts' });

		// The CONFIG_UPDATED subscription now schedules a coalesced refresh, so the
		// render lands on the next microtask rather than synchronously.
		mocks.renderDataInterface.mockClear();
		const stateCallbacks = Object.fromEntries(mocks.onStateChange.mock.calls.map(([event, callback]) => [event, callback]));
		stateCallbacks[mocks.STATE_EVENTS.CONFIG_UPDATED]();
		await Promise.resolve();
		expect(mocks.renderDataInterface).toHaveBeenCalled();
	});

	it('coalesces multiple synchronous state events into a single refresh', async () => {
		document.body.innerHTML = '<div id="file-info"></div>';

		await importMain();

		const stateCallbacks = Object.fromEntries(mocks.onStateChange.mock.calls.map(([event, callback]) => [event, callback]));
		mocks.renderFileList.mockClear();

		// Add-then-select in the same tick should paint once, not twice.
		stateCallbacks[mocks.STATE_EVENTS.DATASET_ADDED]();
		stateCallbacks[mocks.STATE_EVENTS.ACTIVE_DATASET]();
		expect(mocks.renderFileList).not.toHaveBeenCalled();

		await Promise.resolve();
		expect(mocks.renderFileList).toHaveBeenCalledTimes(1);
	});

	it('reports a render error and still serves later scheduled refreshes', async () => {
		document.body.innerHTML = '<div id="file-info"></div>';

		await importMain();

		const stateCallbacks = Object.fromEntries(mocks.onStateChange.mock.calls.map(([event, callback]) => [event, callback]));
		const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
		mocks.renderFileList.mockClear();

		// The first scheduled render throws; the coalescer reports it and clears its
		// queued flag so the next schedule is not wedged.
		mocks.renderFileList.mockImplementationOnce(() => { throw new Error('render boom'); });
		stateCallbacks[mocks.STATE_EVENTS.ACTIVE_DATASET]();
		await Promise.resolve();
		expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'chive-internal-error' }));

		mocks.renderFileList.mockClear();
		stateCallbacks[mocks.STATE_EVENTS.DATASET_ADDED]();
		await Promise.resolve();
		expect(mocks.renderFileList).toHaveBeenCalledTimes(1);
	});

	it('repaints workspace and chart-controls on a columns change, not the list or panel', async () => {
		document.body.innerHTML = '<div id="file-info"></div>';
		mocks.getState.mockReturnValue({ data: { activeIndex: 0 }, ui: { previewRows: 25 } });
		mocks.getLoadedDatasets.mockReturnValue([baseDataset]);
		mocks.getActiveDataset.mockReturnValue(baseDataset);
		mocks.getActiveDatasetIndex.mockReturnValue(0);
		mocks.getPreviewRows.mockReturnValue(25);

		await importMain();

		const stateCallbacks = Object.fromEntries(mocks.onStateChange.mock.calls.map(([event, callback]) => [event, callback]));
		mocks.renderDataInterface.mockClear();
		mocks.renderChartControlsSidebar.mockClear();
		mocks.renderFileList.mockClear();
		mocks.renderSidebarPanel.mockClear();
		mocks.renderCanvasPanel.mockClear();
		mocks.getState.mockClear();

		stateCallbacks[mocks.STATE_EVENTS.COLUMNS_UPDATED]();
		await Promise.resolve();

		expect(mocks.renderDataInterface).toHaveBeenCalledTimes(1);
		expect(mocks.renderChartControlsSidebar).toHaveBeenCalledTimes(1);
		expect(mocks.renderFileList).not.toHaveBeenCalled();
		expect(mocks.renderSidebarPanel).not.toHaveBeenCalled();
		expect(mocks.renderCanvasPanel).not.toHaveBeenCalled();
		// The region flush uses the cheap getters, never the deep-cloning getState.
		expect(mocks.getState).not.toHaveBeenCalled();
	});

	it('repaints only the workspace region on a preview-rows change, without a full state read', async () => {
		document.body.innerHTML = '<div id="file-info"></div>';
		mocks.getState.mockReturnValue({ data: { activeIndex: 0 }, ui: { previewRows: 25 } });
		mocks.getLoadedDatasets.mockReturnValue([baseDataset]);
		mocks.getActiveDataset.mockReturnValue(baseDataset);
		mocks.getActiveDatasetIndex.mockReturnValue(0);
		mocks.getPreviewRows.mockReturnValue(40);

		await importMain();

		const stateCallbacks = Object.fromEntries(mocks.onStateChange.mock.calls.map(([event, callback]) => [event, callback]));
		mocks.renderDataInterface.mockClear();
		mocks.renderFileList.mockClear();
		mocks.renderChartControlsSidebar.mockClear();
		mocks.renderSidebarPanel.mockClear();
		mocks.renderCanvasPanel.mockClear();
		mocks.getState.mockClear();

		// PREVIEW_ROWS_CHANGED repaints only the workspace region on the next microtask.
		stateCallbacks[mocks.STATE_EVENTS.PREVIEW_ROWS_CHANGED]();
		expect(mocks.renderDataInterface).not.toHaveBeenCalled();

		await Promise.resolve();

		expect(mocks.renderDataInterface).toHaveBeenCalledTimes(1);
		// Renders with the committed getPreviewRows(), not whatever getState held.
		expect(mocks.renderDataInterface.mock.calls[0][4]).toBe(40);
		expect(mocks.renderFileList).not.toHaveBeenCalled();
		expect(mocks.renderChartControlsSidebar).not.toHaveBeenCalled();
		expect(mocks.renderSidebarPanel).not.toHaveBeenCalled();
		expect(mocks.renderCanvasPanel).not.toHaveBeenCalled();
		// The region flush uses the cheap getters, never the deep-cloning getState.
		expect(mocks.getState).not.toHaveBeenCalled();
	});

	it('routes CONFIG_UPDATED by payload: chart options skip the panel, the panel tab repaints it', async () => {
		document.body.innerHTML = '<div id="file-info"></div>';
		mocks.getState.mockReturnValue({ data: { activeIndex: 0 }, ui: { previewRows: 25 } });
		mocks.getLoadedDatasets.mockReturnValue([baseDataset]);
		mocks.getActiveDataset.mockReturnValue(baseDataset);
		mocks.getActiveDatasetIndex.mockReturnValue(0);
		mocks.getPreviewRows.mockReturnValue(25);

		await importMain();

		const stateCallbacks = Object.fromEntries(mocks.onStateChange.mock.calls.map(([event, callback]) => [event, callback]));

		// A chart-option payload repaints workspace + controls, never the panel, and
		// never reads the deep-cloning getState.
		mocks.renderDataInterface.mockClear();
		mocks.renderChartControlsSidebar.mockClear();
		mocks.renderSidebarPanel.mockClear();
		mocks.renderCanvasPanel.mockClear();
		mocks.getState.mockClear();
		stateCallbacks[mocks.STATE_EVENTS.CONFIG_UPDATED]({ bar: { enabled: true } });
		await Promise.resolve();
		expect(mocks.renderDataInterface).toHaveBeenCalledTimes(1);
		expect(mocks.renderChartControlsSidebar).toHaveBeenCalledTimes(1);
		expect(mocks.renderSidebarPanel).not.toHaveBeenCalled();
		expect(mocks.renderCanvasPanel).not.toHaveBeenCalled();
		expect(mocks.getState).not.toHaveBeenCalled();

		// Switching to the panel tab also repaints the panel, after the workspace
		// (canonical flush order: the workspace reveals the tab before the panel sizes).
		mocks.renderDataInterface.mockClear();
		mocks.renderCanvasPanel.mockClear();
		stateCallbacks[mocks.STATE_EVENTS.CONFIG_UPDATED]({ activeTab: 'panel' });
		await Promise.resolve();
		expect(mocks.renderDataInterface).toHaveBeenCalledTimes(1);
		expect(mocks.renderCanvasPanel).toHaveBeenCalledTimes(1);
		expect(mocks.renderDataInterface.mock.invocationCallOrder[0])
			.toBeLessThan(mocks.renderCanvasPanel.mock.invocationCallOrder[0]);
	});

	it('lets a full refresh subsume a region scheduled in the same tick (both orders)', async () => {
		document.body.innerHTML = '<div id="file-info"></div>';
		mocks.getState.mockReturnValue({ data: { activeIndex: 0 }, ui: { previewRows: 25 } });
		mocks.getLoadedDatasets.mockReturnValue([baseDataset]);
		mocks.getActiveDataset.mockReturnValue(baseDataset);
		mocks.getActiveDatasetIndex.mockReturnValue(0);
		mocks.getPreviewRows.mockReturnValue(25);

		await importMain();

		const stateCallbacks = Object.fromEntries(mocks.onStateChange.mock.calls.map(([event, callback]) => [event, callback]));

		// Region first, then full: the full subsumes the region (one full render).
		mocks.renderFileList.mockClear();
		mocks.renderDataInterface.mockClear();
		stateCallbacks[mocks.STATE_EVENTS.COLUMNS_UPDATED]();
		stateCallbacks[mocks.STATE_EVENTS.ACTIVE_DATASET]();
		await Promise.resolve();
		expect(mocks.renderFileList).toHaveBeenCalledTimes(1);
		expect(mocks.renderDataInterface).toHaveBeenCalledTimes(1);

		// Full first, then region: the region scheduler bails (full pending).
		mocks.renderFileList.mockClear();
		mocks.renderDataInterface.mockClear();
		stateCallbacks[mocks.STATE_EVENTS.ACTIVE_DATASET]();
		stateCallbacks[mocks.STATE_EVENTS.COLUMNS_UPDATED]();
		await Promise.resolve();
		expect(mocks.renderFileList).toHaveBeenCalledTimes(1);
		expect(mocks.renderDataInterface).toHaveBeenCalledTimes(1);
	});

	it('suppresses a CONFIG_UPDATED emitted during a full refresh (render-time sanitize)', async () => {
		document.body.innerHTML = '<div id="file-info"></div>';
		mocks.getState.mockReturnValue({ data: { activeIndex: 0 }, ui: { previewRows: 25 } });
		mocks.getLoadedDatasets.mockReturnValue([baseDataset]);
		mocks.getActiveDataset.mockReturnValue(baseDataset);
		mocks.getActiveDatasetIndex.mockReturnValue(0);
		mocks.getPreviewRows.mockReturnValue(25);

		await importMain();

		const stateCallbacks = Object.fromEntries(mocks.onStateChange.mock.calls.map(([event, callback]) => [event, callback]));

		// renderDataInterface emits CONFIG_UPDATED mid-render (the global-filter
		// sanitize). Under fullQueued it must schedule no follow-up region render.
		mocks.renderDataInterface.mockClear();
		mocks.renderDataInterface.mockImplementationOnce(() => {
			stateCallbacks[mocks.STATE_EVENTS.CONFIG_UPDATED]({ globalFilter: { rules: [] } });
		});

		stateCallbacks[mocks.STATE_EVENTS.ACTIVE_DATASET]();
		await Promise.resolve();
		await Promise.resolve();

		expect(mocks.renderDataInterface).toHaveBeenCalledTimes(1);
	});

	it('runs the debug refreshView handle as a synchronous full render', async () => {
		document.body.innerHTML = '<div id="file-info"></div>';

		await importMain();

		mocks.renderFileList.mockClear();
		mocks.renderEmptyState.mockClear();

		// chiveDebug.refreshView is runFullRefreshNow: a full render, synchronously.
		window.chiveDebug.refreshView();
		expect(mocks.renderFileList).toHaveBeenCalledTimes(1);
		expect(mocks.renderEmptyState).toHaveBeenCalledTimes(1);
	});

	it('lets a boot render error reject initialization instead of swallowing it', async () => {
		document.body.innerHTML = '<div id="file-info"></div>';
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		mocks.renderFileList.mockImplementationOnce(() => { throw new Error('boot render boom'); });

		await importMain();

		// runFullRefreshNow does not catch, so the throw rejects initializeApplication()
		// and reaches reportInitializationError rather than the refresh-error channel.
		expect(consoleError).toHaveBeenCalledWith('CHIVE initialization failed:', expect.any(Error));
		consoleError.mockRestore();
	});

	it('surfaces initialization failures and falls back when translation is unavailable', async () => {
		document.body.innerHTML = '<div id="file-info"></div>';
		document.body.style.visibility = 'hidden';
		const error = new Error('init failed');
		mocks.initializeI18n.mockRejectedValue(error);
		mocks.t.mockImplementation(() => {
			throw new Error('i18n failed');
		});
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

		await importMain();

		expect(document.body.style.visibility).toBe('visible');
		expect(consoleError).toHaveBeenCalledWith('CHIVE initialization failed:', error);
		expect(mocks.showError).toHaveBeenCalledWith('An internal application error occurred.');
		expect(mocks.initFileManager).not.toHaveBeenCalled();
	});
});
