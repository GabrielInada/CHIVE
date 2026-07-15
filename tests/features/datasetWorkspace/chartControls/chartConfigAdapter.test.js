import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	updateActiveDatasetConfig: vi.fn(),
	normalizeActiveDatasetConfig: vi.fn(),
}));

vi.mock('../../../../src/state/appState.js', () => ({
	normalizeActiveDatasetConfig: mocks.normalizeActiveDatasetConfig,
	updateActiveDatasetConfig: mocks.updateActiveDatasetConfig,
}));

import { createChartConfigWriter } from '../../../../src/features/datasetWorkspace/chartControls/chartConfigAdapter.js';

function makeDataset(barConfig = {}) {
	return { chartConfig: { bar: { color: '#000000', enabled: false, ...barConfig } } };
}

describe('createChartConfigWriter commit', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('merges the patch into the existing chart config through the emitting facade', () => {
		const dataset = makeDataset({ other: 'keep' });
		const writer = createChartConfigWriter({ dataset, chartKey: 'bar' });

		writer.commit({ color: '#ff0000' });

		expect(mocks.updateActiveDatasetConfig).toHaveBeenCalledTimes(1);
		expect(mocks.updateActiveDatasetConfig.mock.calls[0][0]).toEqual({
			bar: { color: '#ff0000', enabled: false, other: 'keep' },
		});
	});

	it('fires onConfigChanged after the write', () => {
		const onConfigChanged = vi.fn();
		const writer = createChartConfigWriter({ dataset: makeDataset(), chartKey: 'bar', onConfigChanged });

		writer.commit({ color: '#ff0000' });

		expect(onConfigChanged).toHaveBeenCalledTimes(1);
	});

	it('does not live-render: a commit refreshes the sidebar through the emitted event', () => {
		const requestLiveRender = vi.fn();
		const writer = createChartConfigWriter({ dataset: makeDataset(), chartKey: 'bar', requestLiveRender });

		writer.commit({ color: '#ff0000' });

		expect(requestLiveRender).not.toHaveBeenCalled();
	});

	it('tolerates an absent onConfigChanged', () => {
		const writer = createChartConfigWriter({ dataset: makeDataset(), chartKey: 'bar' });

		expect(() => writer.commit({ color: '#ff0000' })).not.toThrow();
		expect(mocks.updateActiveDatasetConfig).toHaveBeenCalledTimes(1);
	});
});

describe('createChartConfigWriter preview', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('writes through the non-emitting facade, never the emitting one', () => {
		const writer = createChartConfigWriter({ dataset: makeDataset(), chartKey: 'bar' });

		writer.preview({ color: '#ff0000' });

		// Emitting here would rebuild the controls sidebar mid-drag and steal
		// focus from an open color picker. That is the whole point of the split.
		expect(mocks.updateActiveDatasetConfig).not.toHaveBeenCalled();
		expect(mocks.normalizeActiveDatasetConfig).toHaveBeenCalledTimes(1);
	});

	it('merges an object patch while preserving sibling chart blocks and fields', () => {
		const writer = createChartConfigWriter({ dataset: makeDataset(), chartKey: 'bar' });

		writer.preview({ color: '#ff0000' });

		const normalizer = mocks.normalizeActiveDatasetConfig.mock.calls[0][0];
		const result = normalizer({ bar: { color: '#000000', other: 'keep' }, pie: { enabled: true } });
		expect(result.bar).toEqual({ color: '#ff0000', other: 'keep' });
		expect(result.pie).toEqual({ enabled: true });
	});

	it('accepts a function of the current config for nested updates', () => {
		const writer = createChartConfigWriter({ dataset: makeDataset(), chartKey: 'pie' });

		writer.preview(current => ({
			customSliceColors: { ...current.customSliceColors, North: '#ff0000' },
		}));

		const normalizer = mocks.normalizeActiveDatasetConfig.mock.calls[0][0];
		const result = normalizer({ pie: { enabled: true, customSliceColors: { South: '#00ff00' } } });
		expect(result.pie).toEqual({
			enabled: true,
			customSliceColors: { South: '#00ff00', North: '#ff0000' },
		});
	});

	it('treats a missing config block as empty', () => {
		const writer = createChartConfigWriter({ dataset: makeDataset(), chartKey: 'bar' });

		writer.preview(current => ({ seen: current }));

		const normalizer = mocks.normalizeActiveDatasetConfig.mock.calls[0][0];
		expect(normalizer({}).bar.seen).toEqual({});
	});

	it('requests a live render so the chart repaints without an event', () => {
		const requestLiveRender = vi.fn();
		const writer = createChartConfigWriter({ dataset: makeDataset(), chartKey: 'bar', requestLiveRender });

		writer.preview({ color: '#ff0000' });

		expect(requestLiveRender).toHaveBeenCalledTimes(1);
	});

	it('tolerates an absent requestLiveRender', () => {
		const writer = createChartConfigWriter({ dataset: makeDataset(), chartKey: 'bar' });

		expect(() => writer.preview({ color: '#ff0000' })).not.toThrow();
		expect(mocks.normalizeActiveDatasetConfig).toHaveBeenCalledTimes(1);
	});
});
