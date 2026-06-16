// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	initializeI18n: vi.fn(),
	t: vi.fn(),
	processData: vi.fn(),
	isPersistenceAvailable: vi.fn(),
	hydrateState: vi.fn(),
	enablePersistenceAutoSave: vi.fn(),
	getPersistenceErrorMessageKey: vi.fn(),
	ingestFile: vi.fn(),
	progressLabelForStage: vi.fn(),
	loadPresetSource: vi.fn(),
	PresetFetchTimeoutError: class PresetFetchTimeoutError extends Error {},
	renderEmptyState: vi.fn(),
	renderDataInterface: vi.fn(),
	renderFileList: vi.fn(),
	initChartControls: vi.fn(),
	renderChartControlsSidebar: vi.fn(),
	renderCharts: vi.fn(),
	createDefaultChartConfig: vi.fn(),
	mergeChartConfigWithDefaults: vi.fn(),
	getNumericColumns: vi.fn(),
	rehydratePanelChartSpecs: vi.fn(),
	throttle: vi.fn(),
	getState: vi.fn(),
	getPersistenceSnapshot: vi.fn(),
	getActiveDataset: vi.fn(),
	onStateChange: vi.fn(),
	STATE_EVENTS: {
		ACTIVE_DATASET: 'active-dataset',
		COLUMNS_UPDATED: 'columns-updated',
		CONFIG_UPDATED: 'config-updated',
		STATE_HYDRATED: 'state-hydrated',
	},
	setPreviewRows: vi.fn(),
	addDataset: vi.fn(),
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
	createJoinedDataset: vi.fn(),
	initializeAllEventHandlers: vi.fn(),
	showFeedback: vi.fn(),
	showFeedbackMessage: vi.fn(),
	showError: vi.fn(),
	showErrorMessage: vi.fn(),
	showProgress: vi.fn(),
	progress: {
		onCancel: vi.fn(),
		update: vi.fn(),
		succeed: vi.fn(),
		fail: vi.fn(),
		close: vi.fn(),
	},
	switchTab: vi.fn(),
	enableStateLog: vi.fn(),
	disableStateLog: vi.fn(),
	getStateLog: vi.fn(),
	clearStateLog: vi.fn(),
	getStateSummary: vi.fn(),
}));

vi.mock('../src/services/index.js', () => ({
	initializeI18n: mocks.initializeI18n,
	t: mocks.t,
	processData: mocks.processData,
}));

vi.mock('../src/services/persistenceService.js', () => ({
	isPersistenceAvailable: mocks.isPersistenceAvailable,
	hydrateState: mocks.hydrateState,
	enablePersistenceAutoSave: mocks.enablePersistenceAutoSave,
	getPersistenceErrorMessageKey: mocks.getPersistenceErrorMessageKey,
}));

vi.mock('../src/services/dataIngestService.js', () => ({
	ingestFile: mocks.ingestFile,
	progressLabelForStage: mocks.progressLabelForStage,
}));

vi.mock('../src/services/presetService.js', () => ({
	loadPresetSource: mocks.loadPresetSource,
	PresetFetchTimeoutError: mocks.PresetFetchTimeoutError,
}));

vi.mock('../src/components/index.js', () => ({
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
	createDefaultChartConfig: mocks.createDefaultChartConfig,
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

vi.mock('../src/modules/index.js', () => ({
	getState: mocks.getState,
	getPersistenceSnapshot: mocks.getPersistenceSnapshot,
	getActiveDataset: mocks.getActiveDataset,
	onStateChange: mocks.onStateChange,
	STATE_EVENTS: mocks.STATE_EVENTS,
	setPreviewRows: mocks.setPreviewRows,
	addDataset: mocks.addDataset,
	normalizeActiveDatasetConfig: mocks.normalizeActiveDatasetConfig,
	updateActiveDatasetColumns: mocks.updateActiveDatasetColumns,
	updateActiveDatasetConfig: mocks.updateActiveDatasetConfig,
	replaceAllState: mocks.replaceAllState,
	initPanelManager: mocks.initPanelManager,
	initializeLayoutSelector: mocks.initializeLayoutSelector,
	renderSidebarPanel: mocks.renderSidebarPanel,
	renderCanvasPanel: mocks.renderCanvasPanel,
	initFileManager: mocks.initFileManager,
	getLoadedDatasets: mocks.getLoadedDatasets,
	selectDataset: mocks.selectDataset,
	removeDatasetByIndex: mocks.removeDatasetByIndex,
	createJoinedDataset: mocks.createJoinedDataset,
	initializeAllEventHandlers: mocks.initializeAllEventHandlers,
	showFeedback: mocks.showFeedback,
	showFeedbackMessage: mocks.showFeedbackMessage,
	showError: mocks.showError,
	showErrorMessage: mocks.showErrorMessage,
	showProgress: mocks.showProgress,
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
	mocks.processData.mockImplementation(rows => ({
		rows,
		columns: [{ name: 'keep', type: 'number' }],
	}));
	mocks.isPersistenceAvailable.mockReturnValue(true);
	mocks.hydrateState.mockResolvedValue(undefined);
	mocks.getPersistenceErrorMessageKey.mockReturnValue('chive-persistence-error');
	mocks.progressLabelForStage.mockImplementation((stage, name) => `${stage}:${name}`);
	mocks.loadPresetSource.mockResolvedValue({
		mode: 'inline',
		rows: [{ keep: 1, drop: 2 }],
		dropColumns: ['drop'],
	});
	mocks.ingestFile.mockResolvedValue({
		ok: true,
		value: {
			rows: [{ keep: 2 }],
			columns: [{ name: 'keep', type: 'number' }],
			statsNumeric: [],
			statsCategorical: [],
		},
	});
	mocks.createDefaultChartConfig.mockReturnValue({ activeTab: 'preview' });
	mocks.mergeChartConfigWithDefaults.mockImplementation(config => config);
	mocks.getNumericColumns.mockImplementation(columns => columns.filter(column => column.type === 'number'));
	mocks.throttle.mockImplementation(fn => fn);
	mocks.getState.mockReturnValue({ data: { activeIndex: -1 }, ui: { previewRows: 10 } });
	mocks.getPersistenceSnapshot.mockReturnValue({ snapshot: true });
	mocks.getActiveDataset.mockReturnValue(null);
	mocks.getLoadedDatasets.mockReturnValue([]);
	mocks.createJoinedDataset.mockReturnValue({ ok: true, index: 2, datasetName: 'Joined' });
	mocks.addDataset.mockReturnValue(3);
	mocks.progress.onCancel.mockImplementation(() => {});
	mocks.showProgress.mockReturnValue(mocks.progress);
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
		expect(mocks.initFileManager).toHaveBeenCalledWith(expect.any(Function));
		expect(mocks.initChartControls).toHaveBeenCalledWith(null, expect.any(Function));
		expect(mocks.initPanelManager).toHaveBeenCalledWith(mocks.showFeedback);
		expect(mocks.initializeAllEventHandlers).toHaveBeenCalledTimes(1);
		expect(mocks.onStateChange).toHaveBeenCalledTimes(4);
		expect(mocks.enablePersistenceAutoSave).toHaveBeenCalledWith(
			mocks.getPersistenceSnapshot,
			{ onSaveError: expect.any(Function) },
		);
		expect(mocks.renderFileList).toHaveBeenCalledWith(
			[],
			-1,
			mocks.selectDataset,
			mocks.removeDatasetByIndex,
			expect.any(Function),
			expect.any(Function),
		);
		expect(mocks.renderEmptyState).toHaveBeenCalledTimes(1);
		expect(mocks.switchTab).toHaveBeenCalledWith('preview');

		mocks.enablePersistenceAutoSave.mock.calls[0][1].onSaveError(new Error('db'));
		expect(mocks.showError).toHaveBeenCalledWith('chive-persistence-error');

		windowListeners.get('chive-locale-changed')();
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
			expect.any(Function),
			expect.any(Function),
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

		const stateCallbacks = Object.fromEntries(mocks.onStateChange.mock.calls.map(([event, callback]) => [event, callback]));
		stateCallbacks[mocks.STATE_EVENTS.CONFIG_UPDATED]();
		expect(mocks.renderDataInterface).toHaveBeenCalled();
	});

	it('handles join and inline preset requests passed to the file list', async () => {
		document.body.innerHTML = '<div id="file-info"></div>';
		mocks.getState.mockReturnValue({ data: { activeIndex: 0 }, ui: { previewRows: 10 } });
		mocks.getLoadedDatasets.mockReturnValue([baseDataset]);
		mocks.getActiveDataset.mockReturnValue(baseDataset);

		await importMain();

		const joinHandler = mocks.renderFileList.mock.calls[0][4];
		joinHandler({ leftIndex: 0, rightIndex: 1 });
		expect(mocks.createJoinedDataset).toHaveBeenCalledWith({ leftIndex: 0, rightIndex: 1 });
		expect(mocks.selectDataset).toHaveBeenCalledWith(2);
		expect(mocks.showFeedback).toHaveBeenCalledWith('chive-join-success:Joined');

		mocks.createJoinedDataset.mockReturnValueOnce({ ok: false, message: 'join failed' });
		joinHandler({ bad: true });
		expect(mocks.showError).toHaveBeenCalledWith('join failed');

		const presetHandler = mocks.renderFileList.mock.calls[0][5];
		await presetHandler(null);
		expect(mocks.showError).toHaveBeenCalledWith('chive-join-error-generic');

		await presetHandler({ nameKey: 'preset-name', rows: 1 });
		expect(mocks.loadPresetSource).toHaveBeenCalledWith(
			{ nameKey: 'preset-name', rows: 1 },
			{ signal: expect.any(AbortSignal) },
		);
		expect(mocks.processData).toHaveBeenCalledWith([{ keep: 1 }]);
		expect(mocks.progress.update).toHaveBeenCalledWith(100);
		expect(mocks.addDataset).toHaveBeenCalledWith(expect.objectContaining({
			name: 'preset-name',
			sizeLabel: 'chive-preset-generated-size:1',
			rows: [{ keep: 1 }],
			columns: [{ name: 'keep', type: 'number' }],
			selectedColumns: ['keep'],
			chartConfig: { activeTab: 'preview' },
			precomputedStats: { numeric: [], categorical: [] },
		}));
		expect(mocks.selectDataset).toHaveBeenCalledWith(3);
		expect(mocks.progress.succeed).toHaveBeenCalledWith('chive-preset-load-success:preset-name');
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
