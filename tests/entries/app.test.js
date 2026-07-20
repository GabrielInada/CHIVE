// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	startApplication: vi.fn(),
	installDebugApi: vi.fn(),
}));

vi.mock('../../src/app/applicationInitializer.js', () => ({
	startApplication: mocks.startApplication,
}));

vi.mock('../../src/app/debugApi.js', () => ({
	installDebugApi: mocks.installDebugApi,
}));

async function flush() {
	for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

beforeEach(() => {
	vi.restoreAllMocks();
	vi.resetModules();
	vi.clearAllMocks();
	vi.useFakeTimers();
	mocks.startApplication.mockResolvedValue(true);
	delete window.requestIdleCallback;
});

describe('application page entry', () => {
	it('starts when the DOM is ready and installs debug during the fallback idle task', async () => {
		Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' });

		await import('../../src/entries/app.js');
		await flush();

		expect(mocks.startApplication).toHaveBeenCalledTimes(1);
		expect(mocks.installDebugApi).not.toHaveBeenCalled();

		await vi.runAllTimersAsync();
		await flush();
		expect(mocks.installDebugApi).toHaveBeenCalledTimes(1);
	});

	it('waits for DOMContentLoaded and prefers requestIdleCallback', async () => {
		Object.defineProperty(document, 'readyState', { configurable: true, value: 'loading' });
		let readyCallback;
		let idleCallback;
		window.requestIdleCallback = vi.fn(callback => {
			idleCallback = callback;
			return 1;
		});
		vi.spyOn(document, 'addEventListener').mockImplementation((type, callback) => {
			if (type === 'DOMContentLoaded') readyCallback = callback;
		});

		await import('../../src/entries/app.js');
		expect(mocks.startApplication).not.toHaveBeenCalled();

		await readyCallback();
		expect(window.requestIdleCallback).toHaveBeenCalledTimes(1);
		expect(mocks.installDebugApi).not.toHaveBeenCalled();

		idleCallback();
		await vi.waitFor(() => {
			expect(mocks.installDebugApi).toHaveBeenCalledTimes(1);
		});
	});

	it('does not load debug after failed startup', async () => {
		Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' });
		mocks.startApplication.mockResolvedValue(false);

		await import('../../src/entries/app.js');
		await flush();
		await vi.runAllTimersAsync();

		expect(mocks.installDebugApi).not.toHaveBeenCalled();
	});
});
