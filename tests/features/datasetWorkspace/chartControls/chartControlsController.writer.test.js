// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn(key => key),
	filterVisibleColumns: vi.fn(() => [{ name: 'categoria' }, { name: 'valor' }]),
	getNumericColumnNames: vi.fn(() => ['valor']),
	getCategoricalColumnNames: vi.fn(() => ['categoria']),
	getDateColumnNames: vi.fn(() => []),
	mergeChartConfigWithDefaults: vi.fn(config => ({ bar: { enabled: true, expanded: true }, ...(config || {}) })),
	onStateChange: vi.fn(),
	setActiveChartType: vi.fn(),
	openChartTypePickerDialog: vi.fn(() => Promise.resolve(null)),
	attachListeners: vi.fn(),
	build: vi.fn(() => []),
	computeDefaults: vi.fn(() => ({})),
	getChartControlAdapter: vi.fn(),
	createChartConfigWriter: vi.fn(),
	setLiveRenderCallback: vi.fn(),
	triggerLiveRender: vi.fn(),
	ensureChartHeightResizeHandles: vi.fn(),
	renderChartParamsDOM: vi.fn(),
}));

vi.mock('../../../../src/services/i18nService.js', () => ({ t: mocks.t }));
vi.mock('../../../../src/utils/columnHelpers.js', () => ({
	filterVisibleColumns: mocks.filterVisibleColumns,
	getNumericColumnNames: mocks.getNumericColumnNames,
	getCategoricalColumnNames: mocks.getCategoricalColumnNames,
	getDateColumnNames: mocks.getDateColumnNames,
}));
vi.mock('../../../../src/config/chartDefaults.js', () => ({ mergeChartConfigWithDefaults: mocks.mergeChartConfigWithDefaults }));
vi.mock('../../../../src/state/appState.js', () => ({
	setActiveChartType: mocks.setActiveChartType,
	onStateChange: mocks.onStateChange,
}));
vi.mock('../../../../src/charts/registries/controls.js', () => ({
	getChartControlAdapter: mocks.getChartControlAdapter,
}));
vi.mock('../../../../src/features/datasetWorkspace/chartControls/chartConfigAdapter.js', () => ({
	createChartConfigWriter: mocks.createChartConfigWriter,
}));
vi.mock('../../../../src/features/datasetWorkspace/chartControls/livePreviewBridge.js', () => ({
	setLiveRenderCallback: mocks.setLiveRenderCallback,
	triggerLiveRender: mocks.triggerLiveRender,
}));
vi.mock('../../../../src/features/datasetWorkspace/chartControls/chartHeightResize.js', () => ({
	ensureChartHeightResizeHandles: mocks.ensureChartHeightResizeHandles,
}));
vi.mock('../../../../src/features/datasetWorkspace/views/chartParamsView.js', () => ({
	renderChartParamsDOM: mocks.renderChartParamsDOM,
}));
vi.mock('../../../../src/features/datasetWorkspace/dialogs/chartTypePickerDialog.js', () => ({
	openChartTypePickerDialog: mocks.openChartTypePickerDialog,
}));

import {
	initChartControls,
	renderChartControlsSidebar,
} from '../../../../src/features/datasetWorkspace/chartControls/chartControlsController.js';

function makeDataset() {
	return {
		columns: [{ name: 'categoria', type: 'text' }, { name: 'valor', type: 'number' }],
		selectedColumns: ['categoria', 'valor'],
		chartConfig: { bar: { enabled: true, expanded: true } },
	};
}

describe('chartControlsController writer wiring', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '<div id="viz-chart-params"></div><div id="sidebar-panel-viz"></div>';
		mocks.getChartControlAdapter.mockReturnValue({
			build: mocks.build,
			attachListeners: mocks.attachListeners,
			computeDefaults: mocks.computeDefaults,
		});
	});

	it('forwards the application live-render callback to the bridge, not to the writer', () => {
		const liveRender = vi.fn();
		const onConfigChanged = vi.fn();

		initChartControls(onConfigChanged, liveRender);

		// The bridge owns the callback so it stays replaceable and disable-able;
		// the writer only ever gets the bridge's trigger.
		expect(mocks.setLiveRenderCallback).toHaveBeenCalledTimes(1);
		expect(mocks.setLiveRenderCallback).toHaveBeenCalledWith(liveRender);
	});

	it('builds the writer with the dataset, chart key, change callback, and the bridge trigger', () => {
		const liveRender = vi.fn();
		const onConfigChanged = vi.fn();
		const writer = { commit: vi.fn(), preview: vi.fn() };
		mocks.createChartConfigWriter.mockReturnValue(writer);

		initChartControls(onConfigChanged, liveRender);
		const dataset = makeDataset();
		renderChartControlsSidebar(dataset);

		expect(mocks.createChartConfigWriter).toHaveBeenCalledWith({
			dataset,
			chartKey: 'bar',
			onConfigChanged,
			requestLiveRender: mocks.triggerLiveRender,
		});
		// Not the raw application callback: routing preview writes straight to it
		// would bypass the bridge and break callback replacement.
		expect(mocks.createChartConfigWriter.mock.calls[0][0].requestLiveRender).not.toBe(liveRender);
	});

	it('passes the exact writer instance to the chart package adapter', () => {
		const writer = { commit: vi.fn(), preview: vi.fn() };
		mocks.createChartConfigWriter.mockReturnValue(writer);

		initChartControls(vi.fn(), vi.fn());
		renderChartControlsSidebar(makeDataset());

		expect(mocks.attachListeners).toHaveBeenCalledTimes(1);
		expect(mocks.attachListeners.mock.calls[0].at(-1)).toBe(writer);
	});
});
