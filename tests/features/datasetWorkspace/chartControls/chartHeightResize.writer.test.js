// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	const dataset = { chartConfig: { bar: { chartHeight: 320 } } };
	return {
		dataset,
		t: vi.fn(key => key),
		getActiveDataset: vi.fn(() => dataset),
		writer: { commit: vi.fn(), preview: vi.fn() },
		createChartConfigWriter: vi.fn(),
		triggerLiveRender: vi.fn(),
	};
});

vi.mock('../../../../src/services/i18nService.js', () => ({
	t: mocks.t,
}));

vi.mock('../../../../src/state/appState.js', () => ({
	getActiveDataset: mocks.getActiveDataset,
}));

vi.mock('../../../../src/features/datasetWorkspace/chartControls/chartConfigAdapter.js', () => ({
	createChartConfigWriter: mocks.createChartConfigWriter,
}));

vi.mock('../../../../src/features/datasetWorkspace/chartControls/livePreviewBridge.js', () => ({
	triggerLiveRender: mocks.triggerLiveRender,
}));

import { ensureChartHeightResizeHandles } from '../../../../src/features/datasetWorkspace/chartControls/chartHeightResize.js';

const handle = () => document.querySelector('#chart-block-bar .chart-height-resize-handle');
const pointer = (type, props = {}) => new MouseEvent(type, { bubbles: true, cancelable: true, ...props });

describe('chart height handles write through the chart writer', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.createChartConfigWriter.mockReturnValue(mocks.writer);
		mocks.getActiveDataset.mockReturnValue(mocks.dataset);
		document.body.innerHTML = '<div id="chart-block-bar"><div id="chart-bar-container"></div></div>';
		ensureChartHeightResizeHandles();
	});

	it('previews each height of a drag and commits the last one on release', () => {
		handle().dispatchEvent(pointer('pointerdown', { button: 0, clientY: 100 }));
		window.dispatchEvent(pointer('pointermove', { clientY: 120 }));
		window.dispatchEvent(pointer('pointermove', { clientY: 150 }));
		window.dispatchEvent(pointer('pointerup'));

		expect(mocks.createChartConfigWriter).toHaveBeenCalledWith({
			dataset: mocks.dataset,
			chartKey: 'bar',
			requestLiveRender: mocks.triggerLiveRender,
		});
		expect(mocks.writer.preview.mock.calls).toEqual([[{ chartHeight: 340 }], [{ chartHeight: 370 }]]);
		expect(mocks.writer.commit.mock.calls).toEqual([[{ chartHeight: 370 }]]);
	});

	it('commits a keyboard step, clamped to the chart limits', () => {
		mocks.dataset.chartConfig.bar.chartHeight = 715;
		handle().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
		mocks.dataset.chartConfig.bar.chartHeight = 320;

		expect(mocks.createChartConfigWriter).toHaveBeenCalledWith({ dataset: mocks.dataset, chartKey: 'bar' });
		expect(mocks.writer.commit.mock.calls).toEqual([[{ chartHeight: 720 }]]);
		expect(mocks.writer.preview).not.toHaveBeenCalled();
	});

	it('writes nothing while no dataset is open', () => {
		mocks.getActiveDataset.mockReturnValue(null);

		handle().dispatchEvent(pointer('pointerdown', { button: 0, clientY: 100 }));
		window.dispatchEvent(pointer('pointermove', { clientY: 150 }));
		window.dispatchEvent(pointer('pointerup'));
		handle().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

		expect(mocks.createChartConfigWriter).not.toHaveBeenCalled();
		expect(document.getElementById('chart-block-bar').classList.contains('is-resizing')).toBe(false);
	});
});
