// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getLocale: vi.fn(),
	setLocale: vi.fn(),
	getTinColorRendering: vi.fn(),
	setTinColorRendering: vi.fn(),
	openSettingsDialog: vi.fn(),
}));

vi.mock('../../src/services/i18nService.js', () => ({
	getLocale: mocks.getLocale,
	setLocale: mocks.setLocale,
}));

vi.mock('../../src/services/settingsService.js', () => ({
	getTinColorRendering: mocks.getTinColorRendering,
	setTinColorRendering: mocks.setTinColorRendering,
}));

vi.mock('../../src/components/settingsDialog.js', () => ({
	openSettingsDialog: mocks.openSettingsDialog,
}));

/** Fresh module per test: the controller tracks the open dialog in module state. */
async function initFreshController() {
	vi.resetModules();
	const { initSettingsController } = await import('../../src/app/settingsController.js');
	initSettingsController();
	return initSettingsController;
}

describe('settingsController', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '<button id="btn-settings" type="button" aria-expanded="false"></button>';
		mocks.getLocale.mockReturnValue('pt-BR');
		mocks.getTinColorRendering.mockReturnValue('optimized');
		mocks.openSettingsDialog.mockReturnValue({ close: vi.fn() });
	});

	it('tolerates a document without the settings button', async () => {
		document.body.innerHTML = '';
		await expect(initFreshController()).resolves.toBeTypeOf('function');
	});

	it('opens the dialog with the current locale and stored TIN mode and expands the button', async () => {
		mocks.getLocale.mockReturnValue('en');
		mocks.getTinColorRendering.mockReturnValue('full-ramp');
		await initFreshController();

		const button = document.getElementById('btn-settings');
		button.click();

		expect(mocks.openSettingsDialog).toHaveBeenCalledTimes(1);
		expect(mocks.openSettingsDialog).toHaveBeenCalledWith(expect.objectContaining({
			locale: 'en',
			tinColorRendering: 'full-ramp',
		}));
		expect(button.getAttribute('aria-expanded')).toBe('true');
	});

	it('opens at most one dialog at a time and reopens after close', async () => {
		await initFreshController();
		const button = document.getElementById('btn-settings');

		button.click();
		button.click();
		expect(mocks.openSettingsDialog).toHaveBeenCalledTimes(1);

		mocks.openSettingsDialog.mock.calls[0][0].onClose();
		expect(button.getAttribute('aria-expanded')).toBe('false');

		button.click();
		expect(mocks.openSettingsDialog).toHaveBeenCalledTimes(2);
	});

	it('wires the dialog callbacks to the i18n and settings services', async () => {
		await initFreshController();
		document.getElementById('btn-settings').click();

		const args = mocks.openSettingsDialog.mock.calls[0][0];
		args.onLocaleChange('en');
		args.onTinColorRenderingChange('full-ramp');

		expect(mocks.setLocale).toHaveBeenCalledWith('en');
		expect(mocks.setTinColorRendering).toHaveBeenCalledWith('full-ramp');
	});

	it('does not duplicate listeners on repeated initialization', async () => {
		const initSettingsController = await initFreshController();
		initSettingsController();
		initSettingsController();

		document.getElementById('btn-settings').click();
		expect(mocks.openSettingsDialog).toHaveBeenCalledTimes(1);
	});
});
