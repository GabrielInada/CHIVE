// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getState: vi.fn(),
	getActiveDataset: vi.fn(),
	enableStateLog: vi.fn(),
	disableStateLog: vi.fn(),
	getStateLog: vi.fn(),
	clearStateLog: vi.fn(),
	getStateSummary: vi.fn(),
	getLoadedDatasets: vi.fn(),
	runFullRefreshNow: vi.fn(),
	updateDatasetColumns: vi.fn(),
	updateDatasetConfig: vi.fn(),
	showFeedback: vi.fn(),
	showError: vi.fn(),
}));

vi.mock('../../src/state/appState.js', () => ({
	getState: mocks.getState,
	getActiveDataset: mocks.getActiveDataset,
}));

vi.mock('../../src/state/stateEvents.js', () => ({
	enableStateLog: mocks.enableStateLog,
	disableStateLog: mocks.disableStateLog,
	getStateLog: mocks.getStateLog,
	clearStateLog: mocks.clearStateLog,
}));

vi.mock('../../src/state/stateDebug.js', () => ({
	getStateSummary: mocks.getStateSummary,
}));

vi.mock('../../src/features/datasetWorkspace/datasetController.js', () => ({
	getLoadedDatasets: mocks.getLoadedDatasets,
}));

vi.mock('../../src/app/renderCoordinator.js', () => ({
	runFullRefreshNow: mocks.runFullRefreshNow,
	updateDatasetColumns: mocks.updateDatasetColumns,
	updateDatasetConfig: mocks.updateDatasetConfig,
}));

vi.mock('../../src/ui/feedback.js', () => ({
	showFeedback: mocks.showFeedback,
	showError: mocks.showError,
}));

beforeEach(() => {
	vi.restoreAllMocks();
	vi.resetModules();
	vi.clearAllMocks();
	delete window.chiveDebug;
});

describe('debugApi', () => {
	it('constructs and installs the complete browser-console surface', async () => {
		const { createDebugApi, installDebugApi } = await import('../../src/app/debugApi.js');
		const api = createDebugApi();

		expect(api).toEqual({
			getState: mocks.getState,
			getStateSummary: mocks.getStateSummary,
			getActiveDataset: mocks.getActiveDataset,
			getLoadedDatasets: mocks.getLoadedDatasets,
			updateDatasetColumns: mocks.updateDatasetColumns,
			updateDatasetConfig: mocks.updateDatasetConfig,
			switchTab: expect.any(Function),
			refreshView: mocks.runFullRefreshNow,
			showFeedback: mocks.showFeedback,
			showError: mocks.showError,
			enableStateLog: mocks.enableStateLog,
			disableStateLog: mocks.disableStateLog,
			getStateLog: mocks.getStateLog,
			clearStateLog: mocks.clearStateLog,
		});

		api.switchTab('charts');
		expect(mocks.updateDatasetConfig).toHaveBeenCalledWith({ activeTab: 'charts' });

		expect(installDebugApi()).toEqual(api);
		expect(window.chiveDebug).toEqual(api);
	});
});
