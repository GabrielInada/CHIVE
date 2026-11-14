// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	configurePersistenceBackend, getPersistenceDiagnostics, hydrateState, persistState,
} from '../../src/services/persistence.js';
import { clearErrorLog, getErrorLog } from '../../src/services/diagnostics.js';

vi.mock('../../src/services/persistence/backends/legacyIndexedDbReader.js', () => ({
	hasLegacyMigrationMarker: () => true,
	deleteLegacyState: vi.fn(),
	readLegacyState: vi.fn(),
	setLegacyMigrationMarker: vi.fn(),
}));

let backend;
beforeEach(() => {
	clearErrorLog();
	localStorage.clear();
	backend = { available: () => true, hydrate: vi.fn(async () => null), persist: vi.fn(async () => {}) };
	configurePersistenceBackend(backend);
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	configurePersistenceBackend(null);
	localStorage.clear();
	vi.restoreAllMocks();
});

describe('persistence diagnostics', () => {
	it('distinguishes an unattempted operation, an in-progress save and a successful save', async () => {
		expect(getPersistenceDiagnostics()).toMatchObject({
			available: true, backend: { mode: 'custom' },
			load: { status: 'not-started' }, save: { status: 'not-started' },
		});
		let finish;
		backend.persist.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
		const operation = persistState({});
		expect(getPersistenceDiagnostics().save.status).toBe('pending');
		finish();
		await expect(operation).resolves.toEqual({ ok: true });
		expect(getPersistenceDiagnostics().save.status).toBe('saved');
		getPersistenceDiagnostics().save.status = 'injected';
		expect(getPersistenceDiagnostics().save.status).toBe('saved');
	});

	it('retains failed load/save evidence even when persistence remains available', async () => {
		const error = new Error('private database detail');
		backend.hydrate.mockRejectedValue(error);
		backend.persist.mockRejectedValue(error);
		const onError = vi.fn();
		await hydrateState({ applyStateSnapshot: vi.fn(), onError });
		await expect(persistState({})).resolves.toEqual({ ok: false, error });
		expect(onError).toHaveBeenCalledWith(error);
		expect(getPersistenceDiagnostics()).toMatchObject({
			available: true, load: { status: 'failed' }, save: { status: 'failed' },
		});
		expect(getErrorLog().map(entry => entry.type)).toEqual(['persistence-load-error', 'persistence-save-error']);
		expect(getErrorLog()[0].stack).toBe(error.stack);
		expect(JSON.stringify(getPersistenceDiagnostics())).not.toContain('private');
	});

	it('reports empty versus restored state and preserves hydration exceptions', async () => {
		await hydrateState({ applyStateSnapshot: vi.fn() });
		expect(getPersistenceDiagnostics().load.status).toBe('empty');
		backend.hydrate.mockResolvedValue({
			data: { datasets: [{ id: 'a', name: 'private.csv', rows: [{ x: 1 }], columns: [{ name: 'x', type: 'number' }] }], activeIndex: 0 },
		});
		await hydrateState({ applyStateSnapshot: vi.fn() });
		expect(getPersistenceDiagnostics().load.status).toBe('restored');
		await expect(hydrateState({ applyStateSnapshot: () => { throw new Error('apply failed'); } })).rejects.toThrow('apply failed');
		expect(getPersistenceDiagnostics().load.status).toBe('failed');
	});

	it('does not report unavailable storage as a successful or empty load/save', async () => {
		backend.available = () => false;
		await hydrateState({ applyStateSnapshot: vi.fn() });
		await persistState({});
		expect(getPersistenceDiagnostics()).toMatchObject({
			available: false, load: { status: 'unavailable' }, save: { status: 'unavailable' },
		});
		expect(backend.hydrate).not.toHaveBeenCalled();
		expect(backend.persist).not.toHaveBeenCalled();
	});
});
