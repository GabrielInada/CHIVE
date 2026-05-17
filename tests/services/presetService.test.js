// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPresetSource, PresetFetchTimeoutError } from '../../src/services/presetService.js';

describe('loadPresetSource', () => {
	let originalFetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.useRealTimers();
	});

	it('returns an inline source without calling fetch for presets with an inline data array', async () => {
		const mockFetch = vi.fn();
		globalThis.fetch = mockFetch;

		const preset = { data: [{ x: 1 }, { x: 2 }], dropColumns: ['drop_me'] };
		const result = await loadPresetSource(preset);

		expect(result).toEqual({ mode: 'inline', rows: preset.data, dropColumns: ['drop_me'] });
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('throws preset-data-missing when neither data nor dataUrl is present', async () => {
		await expect(loadPresetSource({})).rejects.toThrow('preset-data-missing');
		await expect(loadPresetSource({ dataUrl: '   ' })).rejects.toThrow('preset-data-missing');
	});

	it('throws preset-fetch-failed:NNN when the response is non-OK', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });

		await expect(loadPresetSource({ dataUrl: 'https://example.test/data.csv' }))
			.rejects.toThrow('preset-fetch-failed:503');
	});

	it('returns a fetched source with kind=csv for a .csv URL on a 200 response', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			text: () => Promise.resolve('x,y\n1,2'),
		});

		const result = await loadPresetSource({ dataUrl: 'https://example.test/data.csv' });

		expect(result).toEqual({
			mode: 'fetched',
			kind: 'csv',
			text: 'x,y\n1,2',
			dropColumns: [],
		});
	});

	it('picks kind=json when preset.dataFormat is json regardless of URL extension', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			text: () => Promise.resolve('[]'),
		});

		const result = await loadPresetSource({
			dataUrl: 'https://example.test/data.bin',
			dataFormat: 'json',
		});

		expect(result.kind).toBe('json');
	});

	it('throws PresetFetchTimeoutError when fetch hangs past the timeout', async () => {
		// Mock fetch as a never-resolving promise that rejects with AbortError
		// when its signal aborts (the standard fetch behavior).
		globalThis.fetch = vi.fn().mockImplementation((url, init) => new Promise((_, reject) => {
			init.signal.addEventListener('abort', () => {
				const err = new Error('aborted');
				err.name = 'AbortError';
				reject(err);
			});
		}));

		// AbortSignal.timeout uses an internal timer queue that Vitest's fake
		// timers don't intercept; use a tiny real timeout via the override.
		await expect(loadPresetSource(
			{ dataUrl: 'https://example.test/slow.csv' },
			{ timeoutMs: 20 },
		)).rejects.toBeInstanceOf(PresetFetchTimeoutError);
	});

	it('throws the original AbortError when the caller signal fires before the timeout', async () => {
		const controller = new AbortController();

		globalThis.fetch = vi.fn().mockImplementation((url, init) => new Promise((_, reject) => {
			init.signal.addEventListener('abort', () => {
				const err = new Error('aborted');
				err.name = 'AbortError';
				reject(err);
			});
		}));

		const promise = loadPresetSource(
			{ dataUrl: 'https://example.test/slow.csv' },
			{ signal: controller.signal, timeoutMs: 60000 /* well past the test */ },
		);
		const assertion = expect(promise).rejects.not.toBeInstanceOf(PresetFetchTimeoutError);

		controller.abort();
		await assertion;
	});

	it('throws PresetFetchTimeoutError when the body-read stalls past the timeout', async () => {
		// Headers arrive immediately, but text() never resolves until aborted.
		globalThis.fetch = vi.fn().mockImplementation((url, init) => Promise.resolve({
			ok: true,
			text: () => new Promise((_, reject) => {
				init.signal.addEventListener('abort', () => {
					const err = new Error('aborted');
					err.name = 'AbortError';
					reject(err);
				});
			}),
		}));

		await expect(loadPresetSource(
			{ dataUrl: 'https://example.test/stalled-body.csv' },
			{ timeoutMs: 20 },
		)).rejects.toBeInstanceOf(PresetFetchTimeoutError);
	});
});
