// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	clearPersistedState,
	configurePersistenceBackend,
	exportProject,
	getPersistenceErrorMessageKey,
	getProjectImportErrorMessageKey,
	hydrateState,
	importProjectBytes,
	isPersistenceAvailable,
	persistState,
} from '../../src/services/persistence.js';
import { makeBackend, makeSnapshot } from './persistence.testSupport.js';

describe('persistence', () => {
	beforeEach(async () => {
		configurePersistenceBackend(makeBackend());
		await clearPersistedState();
		localStorage.clear();
	});

	afterEach(async () => {
		await clearPersistedState();
		localStorage.clear();
		configurePersistenceBackend(null);
	});

	it('exposes exactly the 13 documented exports (no internal leaks through the facade)', async () => {
		const mod = await import('../../src/services/persistence.js');
		expect(Object.keys(mod).sort()).toEqual([
			'PROJECT_FILE_EXTENSION', 'PROJECT_FILE_MIME', 'clearPersistedState',
			'configurePersistenceBackend', 'enablePersistenceAutoSave', 'exportProject',
			'getPersistenceErrorMessageKey', 'getProjectImportErrorMessageKey', 'hydrateState',
			'importProjectBytes', 'isPersistenceAvailable',
			'isProjectDirtyEvent', 'persistState',
		].sort());
	});

	it('reports availability from the active backend', () => {
		expect(isPersistenceAvailable()).toBe(true);
	});

	it('reports unavailable when backend availability throws or is missing', () => {
		configurePersistenceBackend({
			available: () => { throw new Error('blocked'); },
			hydrate: vi.fn(),
			persist: vi.fn(),
			clear: vi.fn(),
		});
		expect(isPersistenceAvailable()).toBe(false);

		configurePersistenceBackend({
			hydrate: vi.fn(),
			persist: vi.fn(),
			clear: vi.fn(),
		});
		expect(isPersistenceAvailable()).toBe(false);
	});

	it('returns typed failures for invalid snapshots, unavailable storage, and missing import/export hooks', async () => {
		configurePersistenceBackend({
			available: () => false,
			hydrate: vi.fn(),
			persist: vi.fn(),
			clear: vi.fn(),
		});
		await expect(persistState(null)).resolves.toEqual(expect.objectContaining({ ok: false }));
		await expect(persistState(makeSnapshot())).resolves.toEqual(expect.objectContaining({ ok: false }));
		await expect(exportProject(makeSnapshot())).resolves.toEqual(expect.objectContaining({ ok: false }));
		await expect(importProjectBytes(new Uint8Array([1]), { replaceAllState: vi.fn() }))
			.resolves.toEqual(expect.objectContaining({ ok: false }));

		configurePersistenceBackend({
			available: () => true,
			hydrate: vi.fn(),
			persist: vi.fn(),
			clear: vi.fn(),
		});
		await expect(exportProject(null)).resolves.toEqual(expect.objectContaining({ ok: false }));
		await expect(exportProject(makeSnapshot())).resolves.toEqual(expect.objectContaining({ ok: false }));
		await expect(importProjectBytes(new Uint8Array([1]), {})).resolves.toEqual(expect.objectContaining({ ok: false }));
		await expect(importProjectBytes(new Uint8Array([1]), { replaceAllState: vi.fn() }))
			.resolves.toEqual(expect.objectContaining({ ok: false }));
	});

	it('handles backend read/write exceptions without throwing', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		configurePersistenceBackend({
			available: () => true,
			hydrate: vi.fn(async () => { throw new Error('read failed'); }),
			persist: vi.fn(async () => { throw Object.assign(new Error('quota full'), { name: 'QuotaExceededError' }); }),
			exportBytes: vi.fn(async () => { throw 'export failed'; }),
			importBytes: vi.fn(async () => { throw { name: 'UnsupportedProjectFileError', message: 'unsupported chive sqlite' }; }),
			clear: vi.fn(async () => { throw new Error('clear failed'); }),
		});

		const replaceAllState = vi.fn();
		await hydrateState({ replaceAllState });
		expect(replaceAllState).not.toHaveBeenCalled();

		const persist = await persistState(makeSnapshot());
		expect(persist.ok).toBe(false);
		expect(getPersistenceErrorMessageKey(persist.error)).toBe('chive-save-failed-quota');

		const exported = await exportProject(makeSnapshot());
		expect(exported.ok).toBe(false);
		expect(exported.error.message).toBe('export failed');

		const imported = await importProjectBytes(new Uint8Array([1]), { replaceAllState });
		expect(imported.ok).toBe(false);
		expect(getProjectImportErrorMessageKey(imported.error)).toBe('chive-project-import-invalid-error');

		await expect(clearPersistedState()).resolves.toBeUndefined();
		warn.mockRestore();
	});
});
