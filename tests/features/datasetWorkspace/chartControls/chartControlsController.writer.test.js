// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn(key => key),
	onStateChange: vi.fn(),
	setActiveChartType: vi.fn(),
	openChartTypePickerDialog: vi.fn(() => Promise.resolve(null)),
	columns: vi.fn(context => context.allColumns),
	computeDefaults: vi.fn(() => ({})),
	getChartControlAdapter: vi.fn(),
	createChartConfigWriter: vi.fn(),
	setLiveRenderCallback: vi.fn(),
	triggerLiveRender: vi.fn(),
	ensureChartHeightResizeHandles: vi.fn(),
	renderChartParamsDOM: vi.fn(),
}));

vi.mock('../../../../src/services/i18nService.js', () => ({ t: mocks.t }));
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
import { deriveShownDataset } from '../../../../src/domain/datasets/shownDataset.js';

function makeDataset() {
	return {
		rows: [{ categoria: 'A', valor: 1 }],
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
			controls: {
				definition: { key: 'bar', allowedValues: {} },
				sections: [{
					id: 'data',
					title: 'Data',
					controls: [{ widget: 'select', id: 'demo-category', key: 'category', label: 'chive-demo-category', columns: mocks.columns }],
				}],
			},
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
		renderChartControlsSidebar(deriveShownDataset(dataset));

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

	it('builds the described controls from the column context it derives, wired to the exact writer', () => {
		const writer = { commit: vi.fn(), preview: vi.fn() };
		mocks.createChartConfigWriter.mockReturnValue(writer);
		const shown = deriveShownDataset(makeDataset());

		initChartControls(vi.fn(), vi.fn());
		renderChartControlsSidebar(shown);

		expect(mocks.columns).toHaveBeenCalledTimes(1);
		const [context, config] = mocks.columns.mock.calls[0];
		expect(context).toEqual({
			numeric: ['valor'],
			categorical: ['categoria'],
			dates: [],
			allColumns: ['categoria', 'valor'],
			baseCategoricalOrAll: ['categoria'],
			rows: shown.rows,
		});
		expect(context.rows).toBe(shown.rows);
		expect(config).toBe(shown.dataset.chartConfig.bar);
		expect(mocks.t).toHaveBeenCalledWith('chive-demo-category');

		// The params view is mocked: take the sections the controller handed it.
		const [section] = mocks.renderChartParamsDOM.mock.calls[0][0].controls;
		const select = section.querySelector('#demo-category');
		select.value = 'valor';
		select.dispatchEvent(new Event('change'));
		expect(writer.commit).toHaveBeenCalledWith({ category: 'valor' });
	});
});
