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
	showFeedbackMessage: vi.fn(),
	showErrorMessage: vi.fn(),
	switchTab: vi.fn(),
}));

vi.mock('../../src/modules/state/appState.js', () => ({
	getState: mocks.getState,
	getActiveDataset: mocks.getActiveDataset,
}));

vi.mock('../../src/modules/state/stateEvents.js', () => ({
	enableStateLog: mocks.enableStateLog,
	disableStateLog: mocks.disableStateLog,
	getStateLog: mocks.getStateLog,
	clearStateLog: mocks.clearStateLog,
}));

vi.mock('../../src/modules/state/stateDebug.js', () => ({
	getStateSummary: mocks.getStateSummary,
}));

vi.mock('../../src/modules/fileManager.js', () => ({
	getLoadedDatasets: mocks.getLoadedDatasets,
}));

vi.mock('../../src/app/renderCoordinator.js', () => ({
	runFullRefreshNow: mocks.runFullRefreshNow,
	updateDatasetColumns: mocks.updateDatasetColumns,
	updateDatasetConfig: mocks.updateDatasetConfig,
}));

vi.mock('../../src/modules/feedbackUI.js', () => ({
	showFeedbackMessage: mocks.showFeedbackMessage,
	showErrorMessage: mocks.showErrorMessage,
}));

vi.mock('../../src/modules/uiManager.js', () => ({
	switchTab: mocks.switchTab,
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
			switchTab: mocks.switchTab,
			refreshView: mocks.runFullRefreshNow,
			showFeedback: mocks.showFeedbackMessage,
			showError: mocks.showErrorMessage,
			enableStateLog: mocks.enableStateLog,
			disableStateLog: mocks.disableStateLog,
			getStateLog: mocks.getStateLog,
			clearStateLog: mocks.clearStateLog,
		});

		expect(installDebugApi()).toEqual(api);
		expect(window.chiveDebug).toEqual(api);
	});
});
