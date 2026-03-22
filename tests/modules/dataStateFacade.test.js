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
