// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	initializeSharedPage: vi.fn(),
}));

vi.mock('../../src/app/sharedPageInitializer.js', () => ({
	initializeSharedPage: mocks.initializeSharedPage,
}));

beforeEach(() => {
	vi.restoreAllMocks();
	vi.resetModules();
	vi.clearAllMocks();
	document.body.style.visibility = '';
	mocks.initializeSharedPage.mockResolvedValue(undefined);
	delete window.chiveDebug;
});

async function flush() {
	for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

describe('about page entry', () => {
	it('runs shared initialization immediately when the DOM is ready', async () => {
		Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' });

		await import('../../src/entries/about.js');

		expect(mocks.initializeSharedPage).toHaveBeenCalledTimes(1);
	});

	it('waits for DOMContentLoaded when the document is still loading', async () => {
		Object.defineProperty(document, 'readyState', { configurable: true, value: 'loading' });
		let readyCallback;
		vi.spyOn(document, 'addEventListener').mockImplementation((type, callback) => {
			if (type === 'DOMContentLoaded') readyCallback = callback;
		});

		await import('../../src/entries/about.js');

		expect(mocks.initializeSharedPage).not.toHaveBeenCalled();

		readyCallback();
		expect(mocks.initializeSharedPage).toHaveBeenCalledTimes(1);
	});

	it('reveals the body and logs when shared initialization rejects', async () => {
		Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' });
		const error = new Error('i18n unavailable');
		mocks.initializeSharedPage.mockRejectedValue(error);
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		document.body.style.visibility = 'hidden';

		await import('../../src/entries/about.js');
		await flush();

		expect(document.body.style.visibility).toBe('visible');
		expect(consoleError).toHaveBeenCalledWith('CHIVE About-page initialization failed:', error);
	});

	it('never installs the debug API', async () => {
		Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' });

		await import('../../src/entries/about.js');
		await flush();

		expect(window.chiveDebug).toBeUndefined();
	});
});
