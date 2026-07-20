import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	getStorageStatus,
	requestPersistentStorage,
} from '../../src/services/storageService.js';

const originalStorage = globalThis.navigator?.storage;

function setStorage(storage) {
	Object.defineProperty(globalThis.navigator, 'storage', {
		value: storage,
		configurable: true,
	});
}

afterEach(() => {
	setStorage(originalStorage);
});

describe('storageService', () => {
	it('reports usage, quota, and persistence without requesting permission', async () => {
		const persist = vi.fn();
		setStorage({
			estimate: vi.fn(async () => ({ usage: 25, quota: 100 })),
			persisted: vi.fn(async () => true),
			persist,
		});

		await expect(getStorageStatus()).resolves.toEqual({
			ok: true,
			usage: 25,
			quota: 100,
			persisted: true,
		});
		expect(persist).not.toHaveBeenCalled();
	});

	it('requests persistent storage only through the explicit request function', async () => {
		const persist = vi.fn(async () => true);
		setStorage({ persist });

		await expect(requestPersistentStorage()).resolves.toEqual({ ok: true, granted: true });
		expect(persist).toHaveBeenCalledTimes(1);
	});

	it('returns stable failures for unavailable and rejected APIs', async () => {
		setStorage(undefined);
		await expect(getStorageStatus()).resolves.toEqual({
			ok: false,
			reason: 'storage-unsupported',
		});

		setStorage({
			estimate: vi.fn(async () => { throw new Error('blocked'); }),
			persist: vi.fn(async () => { throw new Error('blocked'); }),
		});
		await expect(getStorageStatus()).resolves.toEqual({
			ok: false,
			reason: 'storage-status-failed',
		});
		await expect(requestPersistentStorage()).resolves.toEqual({
			ok: false,
			reason: 'storage-persist-failed',
		});
	});
});
