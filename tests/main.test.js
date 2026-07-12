// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	startApplication: vi.fn(),
	installDebugApi: vi.fn(),
}));

vi.mock('../src/app/applicationInitializer.js', () => ({
	startApplication: mocks.startApplication,
}));

vi.mock('../src/app/debugApi.js', () => ({
	installDebugApi: mocks.installDebugApi,
}));

beforeEach(() => {
	vi.restoreAllMocks();
	vi.resetModules();
	vi.clearAllMocks();
});

describe('main browser entrypoint', () => {
	it('starts immediately when the DOM is ready, then installs the debug API', async () => {
		Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' });

		await import('../src/main.js');

		expect(mocks.startApplication).toHaveBeenCalledTimes(1);
		expect(mocks.installDebugApi).toHaveBeenCalledTimes(1);
		expect(mocks.startApplication.mock.invocationCallOrder[0])
			.toBeLessThan(mocks.installDebugApi.mock.invocationCallOrder[0]);
	});

	it('waits for DOMContentLoaded when the document is still loading', async () => {
		Object.defineProperty(document, 'readyState', { configurable: true, value: 'loading' });
		let readyCallback;
		vi.spyOn(document, 'addEventListener').mockImplementation((type, callback) => {
			if (type === 'DOMContentLoaded') readyCallback = callback;
		});

		await import('../src/main.js');

		expect(mocks.startApplication).not.toHaveBeenCalled();
		expect(mocks.installDebugApi).toHaveBeenCalledTimes(1);
		expect(readyCallback).toBe(mocks.startApplication);

		readyCallback();
		expect(mocks.startApplication).toHaveBeenCalledTimes(1);
	});
});
