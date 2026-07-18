// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	initializeI18n: vi.fn(),
	t: vi.fn(),
	isPersistenceAvailable: vi.fn(),
	hydrateState: vi.fn(),
	enablePersistenceAutoSave: vi.fn(),
	getPersistenceErrorMessageKey: vi.fn(),
	getPersistenceSnapshot: vi.fn(),
	replaceAllState: vi.fn(),
	rehydratePanelChartSpecs: vi.fn(),
	throttle: vi.fn(),
	initChartControls: vi.fn(),
	initPanelController: vi.fn(),
	initDatasetController: vi.fn(),
	initializeDomBindings: vi.fn(),
	initSettingsController: vi.fn(),
	showFeedback: vi.fn(),
	showError: vi.fn(),
	livePreviewRender: vi.fn(),
	throttledPreview: vi.fn(),
	runFullRefreshNow: vi.fn(),
	scheduleFullRefresh: vi.fn(),
	setupStateSubscriptions: vi.fn(),
}));

vi.mock('../../src/services/i18nService.js', () => ({
	initializeI18n: mocks.initializeI18n,
	t: mocks.t,
}));

vi.mock('../../src/services/persistence.js', () => ({
	isPersistenceAvailable: mocks.isPersistenceAvailable,
	hydrateState: mocks.hydrateState,
	enablePersistenceAutoSave: mocks.enablePersistenceAutoSave,
	getPersistenceErrorMessageKey: mocks.getPersistenceErrorMessageKey,
}));

vi.mock('../../src/state/appState.js', () => ({
	getPersistenceSnapshot: mocks.getPersistenceSnapshot,
	replaceAllState: mocks.replaceAllState,
}));

vi.mock('../../src/utils/panelHydration.js', () => ({
	rehydratePanelChartSpecs: mocks.rehydratePanelChartSpecs,
}));

vi.mock('../../src/utils/throttle.js', () => ({
	throttle: mocks.throttle,
}));

vi.mock('../../src/features/datasetWorkspace/chartControls/chartControlsController.js', () => ({
	initChartControls: mocks.initChartControls,
}));

vi.mock('../../src/features/panel/panelController.js', () => ({
	initPanelController: mocks.initPanelController,
}));

vi.mock('../../src/features/datasetWorkspace/datasetController.js', () => ({
	initDatasetController: mocks.initDatasetController,
}));

vi.mock('../../src/app/domBindings.js', () => ({
	initializeDomBindings: mocks.initializeDomBindings,
}));

vi.mock('../../src/features/settings/settingsController.js', () => ({
	initSettingsController: mocks.initSettingsController,
}));

vi.mock('../../src/config/settings.js', () => ({
	SETTINGS_CHANGE_EVENT: 'chive-settings-changed',
}));

vi.mock('../../src/ui/feedback.js', () => ({
	showFeedback: mocks.showFeedback,
	showError: mocks.showError,
}));

vi.mock('../../src/app/renderCoordinator.js', () => ({
	livePreviewRender: mocks.livePreviewRender,
	runFullRefreshNow: mocks.runFullRefreshNow,
	scheduleFullRefresh: mocks.scheduleFullRefresh,
	setupStateSubscriptions: mocks.setupStateSubscriptions,
}));

async function importInitializer() {
	return import('../../src/app/applicationInitializer.js');
}

async function flushInitialization() {
	for (let index = 0; index < 8; index += 1) {
		await Promise.resolve();
	}
}

beforeEach(() => {
	vi.restoreAllMocks();
	vi.resetModules();
	vi.clearAllMocks();
	document.body.innerHTML = '';
	document.body.style.visibility = '';
	mocks.initializeI18n.mockResolvedValue(undefined);
	mocks.t.mockImplementation(key => key);
	mocks.isPersistenceAvailable.mockReturnValue(true);
	mocks.hydrateState.mockResolvedValue(undefined);
	mocks.getPersistenceErrorMessageKey.mockReturnValue('chive-persistence-error');
	mocks.throttle.mockReturnValue(mocks.throttledPreview);
});

describe('application initializer', () => {
	// initializeApplication delegates shared setup to the real sharedPageInitializer
	// (deliberately not mocked here), which calls the mocked initializeI18n and
	// initSettingsController below. This stays an integration check of that path.
	it('initializes shared i18n and settings but skips app wiring on non-app pages', async () => {
		const { initializeApplication } = await importInitializer();

		await initializeApplication();

		expect(mocks.initializeI18n).toHaveBeenCalledTimes(1);
		expect(mocks.initSettingsController).toHaveBeenCalledTimes(1);
		expect(mocks.hydrateState).not.toHaveBeenCalled();
		expect(mocks.initDatasetController).not.toHaveBeenCalled();
		expect(mocks.setupStateSubscriptions).not.toHaveBeenCalled();
	});

	it('preserves hydration, controller, subscription, autosave, and render order', async () => {
		document.body.innerHTML = '<div id="file-info"></div>';
		const listeners = new Map();
		vi.spyOn(window, 'addEventListener').mockImplementation((type, listener) => {
			listeners.set(type, listener);
		});
		const { initializeApplication } = await importInitializer();

		await initializeApplication();

		expect(mocks.hydrateState).toHaveBeenCalledWith({
			replaceAllState: mocks.replaceAllState,
			transformPanel: mocks.rehydratePanelChartSpecs,
		});
		expect(mocks.initChartControls).toHaveBeenCalledWith(null, mocks.throttledPreview);
		expect(mocks.throttle).toHaveBeenCalledWith(mocks.livePreviewRender, 120);
		expect(mocks.initPanelController).toHaveBeenCalledWith(mocks.showFeedback);
		expect(mocks.initializeDomBindings).toHaveBeenCalledTimes(1);
		expect(mocks.setupStateSubscriptions).toHaveBeenCalledTimes(1);
		expect(mocks.enablePersistenceAutoSave).toHaveBeenCalledWith(
			mocks.getPersistenceSnapshot,
			{ onSaveError: expect.any(Function) },
		);
		expect(mocks.runFullRefreshNow).toHaveBeenCalledTimes(1);

		expect(mocks.hydrateState.mock.invocationCallOrder[0])
			.toBeLessThan(mocks.initDatasetController.mock.invocationCallOrder[0]);
		expect(mocks.setupStateSubscriptions.mock.invocationCallOrder[0])
			.toBeLessThan(mocks.enablePersistenceAutoSave.mock.invocationCallOrder[0]);
		expect(mocks.enablePersistenceAutoSave.mock.invocationCallOrder[0])
			.toBeLessThan(mocks.runFullRefreshNow.mock.invocationCallOrder[0]);

		mocks.enablePersistenceAutoSave.mock.calls[0][1].onSaveError(new Error('db'));
		expect(mocks.showError).toHaveBeenCalledWith('chive-persistence-error');

		listeners.get('chive-locale-changed')();
		listeners.get('chive-settings-changed')({ detail: { key: 'tinColorRendering' } });
		listeners.get('chive-settings-changed')({ detail: { key: 'something-else' } });
		expect(mocks.scheduleFullRefresh).toHaveBeenCalledTimes(2);

		listeners.get('chive-internal-error')({ detail: { message: 'boom' } });
		listeners.get('chive-internal-error')({});
		expect(mocks.showError).toHaveBeenCalledWith('boom');
		expect(mocks.showError).toHaveBeenCalledWith('chive-error-internal');
	});

	it('continues app startup when persistence is unavailable', async () => {
		document.body.innerHTML = '<div id="file-info"></div>';
		mocks.isPersistenceAvailable.mockReturnValue(false);
		const { initializeApplication } = await importInitializer();

		await initializeApplication();

		expect(mocks.hydrateState).not.toHaveBeenCalled();
		expect(mocks.initDatasetController).toHaveBeenCalledTimes(1);
		expect(mocks.runFullRefreshNow).toHaveBeenCalledTimes(1);
	});

	it('routes boot render failures through the top-level error boundary', async () => {
		document.body.innerHTML = '<div id="file-info"></div>';
		document.body.style.visibility = 'hidden';
		const error = new Error('boot render boom');
		mocks.runFullRefreshNow.mockImplementationOnce(() => {
			throw error;
		});
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { startApplication } = await importInitializer();

		startApplication();
		await flushInitialization();

		expect(document.body.style.visibility).toBe('visible');
		expect(consoleError).toHaveBeenCalledWith('CHIVE initialization failed:', error);
		expect(mocks.showError).toHaveBeenCalledWith('chive-error-internal');
	});

	it('uses a static fallback when initialization and translation both fail', async () => {
		document.body.innerHTML = '<div id="file-info"></div>';
		document.body.style.visibility = 'hidden';
		const error = new Error('init failed');
		mocks.initializeI18n.mockRejectedValue(error);
		mocks.t.mockImplementation(() => {
			throw new Error('i18n failed');
		});
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { startApplication } = await importInitializer();

		startApplication();
		await flushInitialization();

		expect(document.body.style.visibility).toBe('visible');
		expect(consoleError).toHaveBeenCalledWith('CHIVE initialization failed:', error);
		expect(mocks.showError).toHaveBeenCalledWith('An internal application error occurred.');
		expect(mocks.initDatasetController).not.toHaveBeenCalled();
	});
});
