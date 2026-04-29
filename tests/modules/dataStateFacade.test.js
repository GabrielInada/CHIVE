import { describe, expect, it, vi } from 'vitest';
import { createDataStateFacade } from '../../src/modules/dataStateFacade.js';

describe('dataStateFacade', () => {
	it('adds first dataset and auto-selects it', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [], activeIndex: -1 },
			panel: { charts: [], slots: {} },
			ui: {},
		};
		const facade = createDataStateFacade({ appState, emitStateChange });

		const index = facade.addDataset({ dados: [{ a: 1 }], colunas: ['a'] });

		expect(index).toBe(0);
		expect(facade.getActiveDatasetIndex()).toBe(0);
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
		expect(() => facade.addDataset({ dados: 'not array' })).toThrow('Invalid dataset');
	});

	it('does not override activeIndex on subsequent adds', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [], activeIndex: -1 },
			panel: { charts: [], slots: {} },
			ui: {},
		};
		const facade = createDataStateFacade({ appState, emitStateChange });

		facade.addDataset({ dados: [{}], colunas: [] });
		facade.addDataset({ dados: [{}], colunas: [] });
		expect(facade.getActiveDatasetIndex()).toBe(0);
	});

	it('setActiveDataset throws for out-of-range index', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [{ dados: [{}] }], activeIndex: 0 },
			panel: { charts: [], slots: {} },
			ui: {},
		};
		const facade = createDataStateFacade({ appState, emitStateChange });

		expect(() => facade.setActiveDataset(99)).toThrow('Invalid dataset index');
		expect(() => facade.setActiveDataset(-2)).toThrow('Invalid dataset index');
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

	it('updateActiveDatasetConfig merges into existing config', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [{ dados: [{}], colunas: [], configGraficos: { color: 'red' } }], activeIndex: 0 },
			panel: { charts: [], slots: {} },
			ui: {},
		};
		const facade = createDataStateFacade({ appState, emitStateChange });

		facade.updateActiveDatasetConfig({ title: 'Test' });
		expect(appState.data.datasets[0].configGraficos).toEqual({ color: 'red', title: 'Test' });
	});

	it('getAllDatasets returns datasets array', () => {
		const emitStateChange = vi.fn();
		const datasets = [{ dados: [{}], colunas: [] }];
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
			data: { datasets: [{ dados: [{}] }, { dados: [{}] }, { dados: [{}] }], activeIndex: 2 },
			panel: { charts: [], slots: {} },
			ui: {},
		};
		const facade = createDataStateFacade({ appState, emitStateChange });

		facade.removeDataset(0);
		expect(facade.getActiveDatasetIndex()).toBe(1);
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
	});

	it('normalizeActiveDatasetConfig writes config without emitting configUpdated', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [{ dados: [{}], colunas: [], configGraficos: { color: 'red' } }], activeIndex: 0 },
			panel: { charts: [], slots: {} },
			ui: {},
		};
		const facade = createDataStateFacade({ appState, emitStateChange });

		facade.normalizeActiveDatasetConfig(prev => ({ ...prev, normalized: true }));

		expect(appState.data.datasets[0].configGraficos).toEqual({ color: 'red', normalized: true });
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

	it('removing dataset clears panel snapshots and slots', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [{ dados: [{}], colunas: [] }], activeIndex: 0 },
			panel: { charts: [{ id: 1 }], slots: { 'slot-1': 1 } },
			ui: {},
		};
		const facade = createDataStateFacade({ appState, emitStateChange });

		facade.removeDataset(0);

		expect(appState.panel.charts).toEqual([]);
		expect(appState.panel.slots).toEqual({});
		expect(emitStateChange).toHaveBeenCalledWith('datasetRemoved', 0);
	});
});
