// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const STORAGE_KEY = 'chive.settings';
const CHANGE_EVENT = 'chive-settings-changed';

/**
 * The service caches settings in module state, so each test imports a fresh
 * copy to simulate a page load against the current localStorage contents.
 */
async function freshService() {
	vi.resetModules();
	return import('../../src/services/settingsService.js');
}

describe('settingsService', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('defaults to optimized with no stored key', async () => {
		const service = await freshService();
		expect(service.getTinColorRendering()).toBe('optimized');
		expect(service.getSettings()).toEqual({ tinColorRendering: 'optimized' });
	});

	it('restores stored optimized and full-ramp values across loads', async () => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ tinColorRendering: 'full-ramp' }));
		expect((await freshService()).getTinColorRendering()).toBe('full-ramp');

		localStorage.setItem(STORAGE_KEY, JSON.stringify({ tinColorRendering: 'optimized' }));
		expect((await freshService()).getTinColorRendering()).toBe('optimized');
	});

	it.each([
		['malformed JSON', 'not json{{'],
		['an array payload', '["full-ramp"]'],
		['a non-object payload', '"full-ramp"'],
		['a numeric payload', '42'],
		['an unknown enum value', '{"tinColorRendering":"bogus"}'],
		['a null payload', 'null'],
	])('normalizes %s to the default', async (_name, raw) => {
		localStorage.setItem(STORAGE_KEY, raw);
		expect((await freshService()).getTinColorRendering()).toBe('optimized');
	});

	it('writes a normalized value and dispatches exactly one change event', async () => {
		const service = await freshService();
		const listener = vi.fn();
		window.addEventListener(CHANGE_EVENT, listener);

		service.setTinColorRendering('full-ramp');

		expect(service.getTinColorRendering()).toBe('full-ramp');
		expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual({ tinColorRendering: 'full-ramp' });
		expect(listener).toHaveBeenCalledTimes(1);
		expect(listener.mock.calls[0][0].detail).toEqual({ key: 'tinColorRendering', value: 'full-ramp' });
		window.removeEventListener(CHANGE_EVENT, listener);
	});

	it('does not write or emit when the value is unchanged', async () => {
		const service = await freshService();
		const listener = vi.fn();
		window.addEventListener(CHANGE_EVENT, listener);

		service.setTinColorRendering('optimized');

		expect(listener).not.toHaveBeenCalled();
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
		window.removeEventListener(CHANGE_EVENT, listener);
	});

	it('treats an unknown mode as the default, so it is a no-op from the default state', async () => {
		const service = await freshService();
		const listener = vi.fn();
		window.addEventListener(CHANGE_EVENT, listener);

		service.setTinColorRendering('bogus-mode');

		expect(service.getTinColorRendering()).toBe('optimized');
		expect(listener).not.toHaveBeenCalled();
		window.removeEventListener(CHANGE_EVENT, listener);
	});

	it('falls back to the default when localStorage reads throw', async () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new DOMException('denied', 'SecurityError');
		});
		const service = await freshService();
		expect(service.getTinColorRendering()).toBe('optimized');
	});

	it('keeps the in-memory value and still emits when localStorage writes throw', async () => {
		const service = await freshService();
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new DOMException('quota', 'QuotaExceededError');
		});
		const listener = vi.fn();
		window.addEventListener(CHANGE_EVENT, listener);

		service.setTinColorRendering('full-ramp');

		expect(service.getTinColorRendering()).toBe('full-ramp');
		expect(listener).toHaveBeenCalledTimes(1);
		window.removeEventListener(CHANGE_EVENT, listener);
	});

	it('returns a copy from getSettings, so callers cannot mutate the cache', async () => {
		const service = await freshService();
		const settings = service.getSettings();
		settings.tinColorRendering = 'full-ramp';
		expect(service.getTinColorRendering()).toBe('optimized');
	});
});
