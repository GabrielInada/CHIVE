import { describe, expect, it, vi } from 'vitest';
import { createDataStateFacade } from '../../src/state/dataStateFacade.js';

describe('dataStateFacade', () => {
	it('adds first dataset and auto-selects it', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [], activeIndex: -1 },
			panel: { charts: [], slots: {} },
			ui: {},
		};
		const facade = createDataStateFacade({ appState, emitStateChange });

		const index = facade.addDataset({ rows: [{ a: 1 }], columns: ['a'] });

		expect(index).toBe(0);
		expect(appState.data.activeIndex).toBe(0);
		expect(emitStateChange).toHaveBeenCalledWith('datasetAdded', expect.objectContaining({ index: 0 }));
	});

	it('throws on addDataset with invalid input', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [], activeIndex: -1 },
			panel: { charts: [], slots: {} },
			ui: {},
		};
		const facade = createDataStateFacade({ appState, emitStateChange });

		expect(() => facade.addDataset(null)).toThrow('Invalid dataset');
		expect(() => facade.addDataset({ rows: 'not array' })).toThrow('Invalid dataset');
	});

	it('does not override activeIndex on subsequent adds', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [], activeIndex: -1 },
			panel: { charts: [], slots: {} },
			ui: {},
		};
		const facade = createDataStateFacade({ appState, emitStateChange });

		facade.addDataset({ rows: [{}], columns: [] });
		facade.addDataset({ rows: [{}], columns: [] });
		expect(appState.data.activeIndex).toBe(0);
	});

	it('setActiveDataset throws for out-of-range index', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [{ rows: [{}] }], activeIndex: 0 },
			panel: { charts: [], slots: {} },
			ui: {},
		};
		const facade = createDataStateFacade({ appState, emitStateChange });

		expect(() => facade.setActiveDataset(99)).toThrow('Invalid dataset index');
		expect(() => facade.setActiveDataset(-2)).toThrow('Invalid dataset index');
		expect(() => facade.setActiveDataset('0')).toThrow('Invalid dataset index');
		expect(() => facade.setActiveDataset(0.5)).toThrow('Invalid dataset index');
		expect(() => facade.setActiveDataset(NaN)).toThrow('Invalid dataset index');
		expect(appState.data.activeIndex).toBe(0);
		expect(emitStateChange).not.toHaveBeenCalled();
	});

	it('setActiveDataset does not emit for the current index', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [{ rows: [{}] }], activeIndex: 0 },
			panel: { charts: [], slots: {} },
			ui: {},
		};
		const facade = createDataStateFacade({ appState, emitStateChange });

		facade.setActiveDataset(0);
		expect(emitStateChange).not.toHaveBeenCalled();
	});

	it('returns null for getActiveDataset when no datasets', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [], activeIndex: -1 },
			panel: { charts: [], slots: {} },
			ui: {},
		};
		const facade = createDataStateFacade({ appState, emitStateChange });

		expect(facade.getActiveDataset()).toBeNull();
	});

	it('updateActiveDatasetConfig does nothing without active dataset', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [], activeIndex: -1 },
			panel: { charts: [], slots: {} },
			ui: {},
		};
		const facade = createDataStateFacade({ appState, emitStateChange });

		expect(() => facade.updateActiveDatasetConfig({ x: 1 })).not.toThrow();
		expect(emitStateChange).not.toHaveBeenCalledWith('configUpdated', expect.anything());
	});

	it('updateActiveDatasetColumns does nothing without active dataset', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [], activeIndex: -1 },
			panel: { charts: [], slots: {} },
			ui: {},
		};
		const facade = createDataStateFacade({ appState, emitStateChange });

		expect(() => facade.updateActiveDatasetColumns(['a'])).not.toThrow();
	});

	it('stores a copy of valid selected columns and suppresses unchanged writes', () => {
		const emitStateChange = vi.fn();
		const dataset = {
			rows: [{}],
			columns: [{ name: 'a' }, { name: 'b' }],
			selectedColumns: ['a'],
		};
		const appState = {
			data: { datasets: [dataset], activeIndex: 0 },
			panel: { charts: [], slots: {} },
			ui: {},
		};
		const facade = createDataStateFacade({ appState, emitStateChange });
		const selection = ['b', 'a'];

		facade.updateActiveDatasetColumns(selection);
		expect(dataset.selectedColumns).toEqual(['b', 'a']);
		expect(dataset.selectedColumns).not.toBe(selection);
		expect(emitStateChange).toHaveBeenCalledWith('columnsUpdated', ['b', 'a']);

		emitStateChange.mockClear();
		facade.updateActiveDatasetColumns(['b', 'a']);
		expect(emitStateChange).not.toHaveBeenCalled();
	});

	it('rejects invalid selected-column shapes before mutation', () => {
		const emitStateChange = vi.fn();
		const dataset = {
			rows: [{}],
			columns: [{ name: 'a' }, { name: 'b' }],
			selectedColumns: ['a'],
		};
		const appState = {
			data: { datasets: [dataset], activeIndex: 0 },
			panel: { charts: [], slots: {} },
			ui: {},
		};
		const facade = createDataStateFacade({ appState, emitStateChange });

		expect(() => facade.updateActiveDatasetColumns('a')).toThrow('Invalid selected columns');
		expect(() => facade.updateActiveDatasetColumns(['missing'])).toThrow('Invalid selected columns');
		expect(() => facade.updateActiveDatasetColumns(['a', 'a'])).toThrow('Invalid selected columns');
		expect(() => facade.updateActiveDatasetColumns(['a', null])).toThrow('Invalid selected columns');
		expect(dataset.selectedColumns).toEqual(['a']);
		expect(emitStateChange).not.toHaveBeenCalled();
	});

	it('updateActiveDatasetConfig merges the patch and canonicalizes the config', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [{ rows: [{}], columns: [], chartConfig: { color: 'red' } }], activeIndex: 0 },
			panel: { charts: [], slots: {} },
			ui: {},
		};
		const facade = createDataStateFacade({ appState, emitStateChange });

		facade.updateActiveDatasetConfig({ title: 'Test' });
		const config = appState.data.datasets[0].chartConfig;
		// Custom + patched top-level fields survive the merge...
		expect(config).toMatchObject({ color: 'red', title: 'Test' });
		// ...and the stored config is now canonical (default blocks filled).
		expect(config.bar).toBeDefined();
		expect(config.scatter).toBeDefined();
		expect(config.globalFilter).toEqual({ rules: [], combine: 'AND' });
		// The emitted payload stays the raw patch (a routing hint).
		expect(emitStateChange).toHaveBeenCalledWith('configUpdated', { title: 'Test' });
	});

	it('emits DATASET_ADDED with the stored, canonical dataset (payload identity)', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [], activeIndex: -1 },
			panel: { charts: [], slots: {} },
			ui: {},
		};
		const facade = createDataStateFacade({ appState, emitStateChange });

		const index = facade.addDataset({
			rows: [{ a: 1 }],
			columns: [{ name: 'a', type: 'number' }],
			chartConfig: { bar: { enabled: true } },
		});

		const payload = emitStateChange.mock.calls.find(([type]) => type === 'datasetAdded')[1];
		// The emit carries the stored dataset object, not the stale caller input.
		expect(payload.dataset).toBe(appState.data.datasets[index]);
		// Its config is canonical: the partial bar block is default-filled.
		expect(payload.dataset.chartConfig.bar.enabled).toBe(true);
		expect(payload.dataset.chartConfig.bar.sort).toBeDefined();
		expect(payload.dataset.chartConfig.scatter).toBeDefined();
	});

	it('updateActiveDatasetConfig trims a stale filter in state but emits the raw patch', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: {
				datasets: [{ rows: [{}], columns: [{ name: 'age', type: 'number' }], chartConfig: {} }],
				activeIndex: 0,
			},
			panel: { charts: [], slots: {} },
			ui: {},
		};
		const facade = createDataStateFacade({ appState, emitStateChange });

		const staleFilter = { rules: [{ column: 'gone', mode: 'categorical', include: ['v:N'] }] };
		facade.updateActiveDatasetConfig({ globalFilter: staleFilter });

		// State stores the trimmed canonical filter (the absent column is gone)...
		expect(appState.data.datasets[0].chartConfig.globalFilter.rules).toEqual([]);
		// ...but the emitted payload is still the raw, untrimmed patch.
		expect(emitStateChange).toHaveBeenCalledWith('configUpdated', { globalFilter: staleFilter });
	});

	it('updateActiveDatasetConfig repairs malformed existing config before merging a patch', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: {
				datasets: [{ rows: [{}], columns: [], chartConfig: 'bad' }],
				activeIndex: 0,
			},
			panel: { charts: [], slots: {} },
			ui: {},
		};
		const facade = createDataStateFacade({ appState, emitStateChange });

		facade.updateActiveDatasetConfig({ title: 'Test' });

		const config = appState.data.datasets[0].chartConfig;
		expect(config.title).toBe('Test');
		expect(config.bar).toBeDefined();
		expect(config).not.toHaveProperty('0');
		expect(config).not.toHaveProperty('1');
		expect(config).not.toHaveProperty('2');
		expect(emitStateChange).toHaveBeenCalledWith('configUpdated', { title: 'Test' });
	});

	it('updateActiveDatasetConfig emits an activeTab-only payload for a tab switch', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [{ rows: [{}], columns: [], chartConfig: {} }], activeIndex: 0 },
			panel: { charts: [], slots: {} },
			ui: {},
		};
		const facade = createDataStateFacade({ appState, emitStateChange });

		facade.updateActiveDatasetConfig({ activeTab: 'bar' });
		expect(emitStateChange).toHaveBeenCalledWith('configUpdated', { activeTab: 'bar' });
	});

	it('getActiveDatasetIndex returns the committed active index', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [{ rows: [{}] }, { rows: [{}] }], activeIndex: 1 },
			panel: { charts: [], slots: {} },
			ui: {},
		};
		const facade = createDataStateFacade({ appState, emitStateChange });

		expect(facade.getActiveDatasetIndex()).toBe(1);
		facade.setActiveDataset(0);
		expect(facade.getActiveDatasetIndex()).toBe(0);
	});

	it('getActiveDatasetIndex returns -1 when no dataset is active', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [], activeIndex: -1 },
			panel: { charts: [], slots: {} },
			ui: {},
		};
		const facade = createDataStateFacade({ appState, emitStateChange });

		expect(facade.getActiveDatasetIndex()).toBe(-1);
	});

	it('getAllDatasets returns datasets array', () => {
		const emitStateChange = vi.fn();
		const datasets = [{ rows: [{}], columns: [] }];
		const appState = {
			data: { datasets, activeIndex: 0 },
			panel: { charts: [], slots: {} },
			ui: {},
		};
		const facade = createDataStateFacade({ appState, emitStateChange });

		expect(facade.getAllDatasets()).toBe(datasets);
	});

	it('removeDataset adjusts activeIndex when removing before active', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [{ rows: [{}] }, { rows: [{}] }, { rows: [{}] }], activeIndex: 2 },
			panel: { charts: [], slots: {} },
			ui: {},
		};
		const facade = createDataStateFacade({ appState, emitStateChange });

		facade.removeDataset(0);
		expect(appState.data.activeIndex).toBe(1);
	});

	it('removeDataset throws for invalid index', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [], activeIndex: -1 },
			panel: { charts: [], slots: {} },
			ui: {},
		};
		const facade = createDataStateFacade({ appState, emitStateChange });

		expect(() => facade.removeDataset(-1)).toThrow();
		expect(() => facade.removeDataset(5)).toThrow();
		expect(() => facade.removeDataset('0')).toThrow();
		expect(() => facade.removeDataset(0.5)).toThrow();
		expect(() => facade.removeDataset(NaN)).toThrow();
		expect(emitStateChange).not.toHaveBeenCalled();
	});

	it('normalizeActiveDatasetConfig writes config without emitting configUpdated', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [{ rows: [{}], columns: [], chartConfig: { color: 'red' } }], activeIndex: 0 },
			panel: { charts: [], slots: {} },
			ui: {},
		};
		const facade = createDataStateFacade({ appState, emitStateChange });

		facade.normalizeActiveDatasetConfig(prev => ({ ...prev, normalized: true }));

		expect(appState.data.datasets[0].chartConfig).toEqual({ color: 'red', normalized: true });
		expect(emitStateChange).not.toHaveBeenCalledWith('configUpdated', expect.anything());
	});

	it('normalizeActiveDatasetConfig is a no-op when no dataset is active', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [], activeIndex: -1 },
			panel: { charts: [], slots: {} },
			ui: {},
		};
		const facade = createDataStateFacade({ appState, emitStateChange });

		expect(() => facade.normalizeActiveDatasetConfig(() => ({ x: 1 }))).not.toThrow();
		expect(emitStateChange).not.toHaveBeenCalled();
	});

	it('removing a dataset preserves detached panel snapshots and assignments', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [{ rows: [{}], columns: [] }], activeIndex: 0 },
			panel: {
				charts: [{ id: 1, dataSnapshot: [{ x: 1 }], columnsSnapshot: [{ name: 'x' }] }],
				slots: { 'slot-1': 1 },
				blocks: [{ id: 'block-1', slots: { 'slot-1': 1 } }],
			},
			ui: {},
		};
		const facade = createDataStateFacade({ appState, emitStateChange });

		facade.removeDataset(0);

		expect(appState.panel.charts).toHaveLength(1);
		expect(appState.panel.slots).toEqual({ 'slot-1': 1 });
		expect(appState.panel.blocks[0].slots).toEqual({ 'slot-1': 1 });
		expect(emitStateChange).toHaveBeenCalledWith('datasetRemoved', 0);
	});
});
