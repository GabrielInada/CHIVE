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
	setActiveDatasetColumnSelection: vi.fn(),
	updateDatasetConfig: vi.fn(),
	showFeedback: vi.fn(),
	showError: vi.fn(),
}));

vi.mock('../../src/state/appState.js', () => ({
	getState: mocks.getState,
	getActiveDataset: mocks.getActiveDataset,
}));

vi.mock('../../src/state/stateEvents.js', async importOriginal => ({
	...await importOriginal(),
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
	setActiveDatasetColumnSelection: mocks.setActiveDatasetColumnSelection,
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

		expect(api).toMatchObject({
			getState: mocks.getState,
			getStateSummary: mocks.getStateSummary,
			getActiveDataset: mocks.getActiveDataset,
			getLoadedDatasets: mocks.getLoadedDatasets,
			setActiveDatasetColumnSelection: mocks.setActiveDatasetColumnSelection,
			updateDatasetConfig: mocks.updateDatasetConfig,
			switchTab: expect.any(Function),
			refreshView: mocks.runFullRefreshNow,
			showFeedback: mocks.showFeedback,
			showError: mocks.showError,
			enableStateLog: mocks.enableStateLog,
			disableStateLog: mocks.disableStateLog,
			getStateLog: mocks.getStateLog,
			clearStateLog: mocks.clearStateLog,
			getErrorLog: expect.any(Function),
			clearErrorLog: expect.any(Function),
			getStartupStatus: expect.any(Function),
			getDiagnosticReport: expect.any(Function),
			exportDiagnosticReport: expect.any(Function),
		});

		api.switchTab('charts');
		expect(mocks.updateDatasetConfig).toHaveBeenCalledWith({ activeTab: 'charts' });

		const early = {};
		window.chiveDebug = early;
		expect(installDebugApi()).toBe(early);
		expect(window.chiveDebug.getState).toBe(api.getState);
	});
});
