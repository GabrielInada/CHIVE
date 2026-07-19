// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	clearPersistedState,
	configurePersistenceBackend,
	exportProject,
	getProjectImportErrorMessageKey,
	hydrateState,
	importProjectBytes,
} from '../../src/services/persistence.js';
import { goodRecord, makeBackend, makeSnapshot } from './persistence.testSupport.js';

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

	it('exports full project bytes and imports them as the saved current project', async () => {
		const exported = await exportProject(makeSnapshot());
		expect(exported.ok).toBe(true);
		expect(exported.bytes).toBeInstanceOf(Uint8Array);
		expect(exported.fileName).toMatch(/^chive-project-.*\.chive\.sqlite3$/);

		await clearPersistedState();
		const replaceAllState = vi.fn();
		const transformPanel = vi.fn(panel => ({
			...panel,
			charts: panel.charts.map(chart => ({ ...chart, config: { ...chart.config, imported: true } })),
		}));
		const imported = await importProjectBytes(exported.bytes, { replaceAllState, transformPanel });

		expect(imported.ok).toBe(true);
		expect(replaceAllState).toHaveBeenCalledTimes(1);
		expect(replaceAllState.mock.calls[0][0].data.datasets.map(dataset => dataset.id)).toEqual(['ds-1', 'ds-2']);
		expect(replaceAllState.mock.calls[0][0].panel.charts[0].config.imported).toBe(true);

		const hydratedReplace = vi.fn();
		await hydrateState({ replaceAllState: hydratedReplace });
		expect(hydratedReplace.mock.calls[0][0].data.datasets.map(dataset => dataset.id)).toEqual(['ds-1', 'ds-2']);
	});

	it('rejects work-only project imports in v1', async () => {
		const exported = await exportProject(makeSnapshot(), { workOnly: true });
		expect(exported.ok).toBe(true);
		expect(exported.fileName).toContain('-work-only-');

		const replaceAllState = vi.fn();
		const imported = await importProjectBytes(exported.bytes, { replaceAllState });

		expect(imported.ok).toBe(false);
		expect(getProjectImportErrorMessageKey(imported.error)).toBe('chive-project-import-work-only-error');
		expect(replaceAllState).not.toHaveBeenCalled();
	});

	it('runtime import clears the current panel when the file has no panel doc', async () => {
		const persist = vi.fn(async () => {});
		configurePersistenceBackend({
			available: () => true,
			hydrate: async () => null,
			importBytes: async () => ({
				data: {
					datasets: [goodRecord('only')],
					activeDatasetId: 'only',
				},
				panel: null,
			}),
			persist,
			clear: vi.fn(),
		});
		const replaceAllState = vi.fn();

		const imported = await importProjectBytes(new Uint8Array([1]), { replaceAllState });

		expect(imported.ok).toBe(true);
		expect(replaceAllState.mock.calls[0][0].panel).toEqual({
			charts: [],
			slots: {},
			layout: 'template-2col',
			blocks: [],
			nextBlockId: 1,
			nextChartId: 0,
		});
		expect(persist.mock.calls[0][0].panel.charts).toEqual([]);
	});

	it('persists canonical dataset config before replacing state (import ordering)', async () => {
		const persist = vi.fn(async () => {});
		configurePersistenceBackend({
			available: () => true,
			hydrate: async () => null,
			importBytes: async () => ({
				data: {
					datasets: [{
						id: 'only',
						name: 'only.csv',
						rows: [{ x: 1 }],
						columns: [{ name: 'x', type: 'number' }],
						selectedColumns: ['x'],
						chartConfig: {
							bar: { enabled: true },
							globalFilter: { rules: [{ column: 'gone', mode: 'categorical', include: ['v:N'] }] },
						},
					}],
					activeDatasetId: 'only',
				},
				panel: null,
			}),
			persist,
			clear: vi.fn(),
		});
		const replaceAllState = vi.fn();

		const imported = await importProjectBytes(new Uint8Array([1]), { replaceAllState });

		expect(imported.ok).toBe(true);
		// importProjectBytes persists BEFORE replaceAllState, so this proves the stored
		// bytes are canonical, not only the in-memory copy: partial bar block is
		// default-filled and the stale filter (column not in the dataset) is trimmed.
		const persistedConfig = persist.mock.calls[0][0].data.datasets[0].chartConfig;
		expect(persistedConfig.bar.enabled).toBe(true);
		expect(persistedConfig.bar.sort).toBeDefined();
		expect(persistedConfig.globalFilter.rules).toEqual([]);
	});
});
