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
import { ingestDataset } from '../../src/domain/datasets/ingest.js';

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

	it.each([
		['preview', 'preview'],
		['charts', 'charts'],
		['panel', 'panel'],
		[undefined, 'preview'],
		['unknown', 'preview'],
		['', 'preview'],
		[null, 'preview'],
		[1, 'preview'],
		[true, 'preview'],
		[['charts'], 'preview'],
		[{ tab: 'charts' }, 'preview'],
	])('imports saved activeTab %j as %s and retains it on reload', async (activeTab, expectedTab) => {
		const dataset = {
			...goodRecord(),
			chartConfig: activeTab === undefined ? {} : { activeTab },
		};
		const exported = await exportProject(makeSnapshot({ data: { datasets: [dataset], activeIndex: 0 } }));
		expect(exported.ok).toBe(true);
		await clearPersistedState();

		const applyStateSnapshot = vi.fn();
		const imported = await importProjectBytes(exported.bytes, { applyStateSnapshot });
		expect(imported.ok).toBe(true);
		expect(applyStateSnapshot).toHaveBeenCalledTimes(1);
		expect(applyStateSnapshot.mock.calls[0][0].data.datasets[0].chartConfig.activeTab).toBe(expectedTab);

		const hydratedReplace = vi.fn();
		await hydrateState({ applyStateSnapshot: hydratedReplace });
		expect(hydratedReplace).toHaveBeenCalledTimes(1);
		expect(hydratedReplace.mock.calls[0][0].data.datasets[0].chartConfig.activeTab).toBe(expectedTab);
	});

	it('exports full project bytes and imports them as the saved current project', async () => {
		const exported = await exportProject(makeSnapshot());
		expect(exported.ok).toBe(true);
		expect(exported.bytes).toBeInstanceOf(Uint8Array);
		expect(exported.fileName).toMatch(/^chive-project-.*\.chive\.sqlite3$/);

		await clearPersistedState();
		const applyStateSnapshot = vi.fn();
		const transformPanel = vi.fn(panel => ({
			...panel,
			charts: panel.charts.map(chart => ({ ...chart, config: { ...chart.config, imported: true } })),
		}));
		const imported = await importProjectBytes(exported.bytes, { applyStateSnapshot, transformPanel });

		expect(imported.ok).toBe(true);
		expect(applyStateSnapshot).toHaveBeenCalledTimes(1);
		expect(applyStateSnapshot.mock.calls[0][0].data.datasets.map(dataset => dataset.id)).toEqual(['ds-1', 'ds-2']);
		expect(applyStateSnapshot.mock.calls[0][0].panel.charts[0].config.imported).toBe(true);

		const hydratedReplace = vi.fn();
		await hydrateState({ applyStateSnapshot: hydratedReplace });
		expect(hydratedReplace.mock.calls[0][0].data.datasets.map(dataset => dataset.id)).toEqual(['ds-1', 'ds-2']);
	});

	it('retains the numeric format of text columns for joins after export, import, and hydration', async () => {
		const { rows, columns } = ingestDataset({
			kind: 'csv',
			text: 'id,population\na,1.000\nb,unknown\n',
			options: { decimalSeparator: ',' },
		}).value;
		const dataset = { ...goodRecord('comma'), rows, columns, selectedColumns: ['id', 'population'] };
		const exported = await exportProject(makeSnapshot({ data: { datasets: [dataset], activeIndex: 0 } }));
		expect(exported.ok).toBe(true);
		const imported = await importProjectBytes(exported.bytes, { applyStateSnapshot: vi.fn() });
		expect(imported.ok).toBe(true);
		const applyStateSnapshot = vi.fn();
		await hydrateState({ applyStateSnapshot });
		const restored = applyStateSnapshot.mock.calls[0][0].data.datasets[0];
		const joined = ingestDataset({
			kind: 'join',
			join: {
				leftRows: restored.rows,
				leftColumnSpecs: restored.columns,
				rightRows: [{ id: 'a' }],
				leftKeys: ['id'],
				rightKeys: ['id'],
				leftColumns: ['population'],
				rightColumns: [],
			},
		}).value;
		expect(joined.rows).toEqual([{ population: 1000 }]);
	});

	it('rejects work-only project imports in v1', async () => {
		const backend = makeBackend();
		const exportBytes = vi.spyOn(backend, 'exportBytes');
		configurePersistenceBackend(backend);

		const exported = await exportProject(makeSnapshot(), { omitDataPayloads: true });
		expect(exported.ok).toBe(true);
		expect(exported.fileName).toContain('-work-only-');
		// The real backend still honors the former `workOnly` key, so name the
		// option here: a stale key would export the same file and pass.
		expect(exportBytes).toHaveBeenCalledWith(expect.any(Object), { omitDataPayloads: true });

		const applyStateSnapshot = vi.fn();
		const imported = await importProjectBytes(exported.bytes, { applyStateSnapshot });

		expect(imported.ok).toBe(false);
		expect(getProjectImportErrorMessageKey(imported.error)).toBe('chive-project-import-work-only-error');
		expect(applyStateSnapshot).not.toHaveBeenCalled();
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
		const applyStateSnapshot = vi.fn();

		const imported = await importProjectBytes(new Uint8Array([1]), { applyStateSnapshot });

		expect(imported.ok).toBe(true);
		expect(applyStateSnapshot.mock.calls[0][0].panel).toEqual({
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
		const applyStateSnapshot = vi.fn();

		const imported = await importProjectBytes(new Uint8Array([1]), { applyStateSnapshot });

		expect(imported.ok).toBe(true);
		// importProjectBytes persists BEFORE applyStateSnapshot, so this proves the stored
		// bytes are canonical, not only the in-memory copy: partial bar block is
		// default-filled and the stale filter (column not in the dataset) is trimmed.
		const persistedConfig = persist.mock.calls[0][0].data.datasets[0].chartConfig;
		expect(persistedConfig.bar.enabled).toBe(true);
		expect(persistedConfig.bar.sort).toBeDefined();
		expect(persistedConfig.globalFilter.rules).toEqual([]);
	});
});
