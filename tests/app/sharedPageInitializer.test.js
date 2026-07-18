import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	initializeI18n: vi.fn(),
	initSettingsController: vi.fn(),
}));

vi.mock('../../src/services/i18nService.js', () => ({
	initializeI18n: mocks.initializeI18n,
}));

vi.mock('../../src/features/settings/settingsController.js', () => ({
	initSettingsController: mocks.initSettingsController,
}));

beforeEach(() => {
	vi.restoreAllMocks();
	vi.resetModules();
	vi.clearAllMocks();
	mocks.initializeI18n.mockResolvedValue(undefined);
});

async function importShared() {
	return import('../../src/app/sharedPageInitializer.js');
}

describe('shared page initializer', () => {
	it('initializes i18n before wiring the settings controller', async () => {
		const { initializeSharedPage } = await importShared();

		await initializeSharedPage();

		expect(mocks.initializeI18n).toHaveBeenCalledTimes(1);
		expect(mocks.initSettingsController).toHaveBeenCalledTimes(1);
		expect(mocks.initializeI18n.mock.invocationCallOrder[0])
			.toBeLessThan(mocks.initSettingsController.mock.invocationCallOrder[0]);
	});

	it('waits for async i18n completion before wiring settings', async () => {
		let resolveI18n;
		mocks.initializeI18n.mockReturnValue(new Promise(resolve => { resolveI18n = resolve; }));
		const { initializeSharedPage } = await importShared();

		const done = initializeSharedPage();
		await Promise.resolve();
		expect(mocks.initSettingsController).not.toHaveBeenCalled();

		resolveI18n();
		await done;
		expect(mocks.initSettingsController).toHaveBeenCalledTimes(1);
	});

	it('propagates an i18n failure and does not wire settings', async () => {
		mocks.initializeI18n.mockRejectedValue(new Error('bundle load failed'));
		const { initializeSharedPage } = await importShared();

		await expect(initializeSharedPage()).rejects.toThrow('bundle load failed');
		expect(mocks.initSettingsController).not.toHaveBeenCalled();
	});
});
