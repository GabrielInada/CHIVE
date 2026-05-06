import { describe, expect, it, vi } from 'vitest';
import { createDataStateFacade } from '../../src/modules/dataStateFacade.js';

function makeFacade() {
	const emitStateChange = vi.fn();
	const appState = {
		data: { datasets: [], activeIndex: -1 },
		panel: { charts: [], slots: {} },
		ui: {},
	};
	return { facade: createDataStateFacade({ appState, emitStateChange }), appState, emitStateChange };
}

describe('dataStateFacade dirty tracking', () => {
	it('addDataset marks the new dataset id dirty', () => {
		const { facade } = makeFacade();
		facade.addDataset({ id: 'ds-1', dados: [{ a: 1 }], colunas: [] });

		expect(facade.getDirtyDatasetIds()).toEqual({ dirty: ['ds-1'], removed: [] });
	});

	it('addDataset stamps an id when missing and marks that id dirty', () => {
		const { facade } = makeFacade();
		facade.addDataset({ dados: [{ a: 1 }], colunas: [] });
		const { dirty } = facade.getDirtyDatasetIds();

		expect(dirty).toHaveLength(1);
		expect(typeof dirty[0]).toBe('string');
		expect(dirty[0].length).toBeGreaterThan(0);
	});

	it('removeDataset adds id to removed and clears it from dirty', () => {
		const { facade } = makeFacade();
		facade.addDataset({ id: 'ds-1', dados: [{ a: 1 }], colunas: [] });
		facade.clearDirtyDatasetIds();

		// Pretend ds-1 was persisted earlier; an unrelated edit dirties it again.
		facade.updateActiveDatasetConfig({ foo: 1 });
		expect(facade.getDirtyDatasetIds().dirty).toEqual(['ds-1']);

		facade.removeDataset(0);
		const diff = facade.getDirtyDatasetIds();
		expect(diff.dirty).toEqual([]);          // dirty mark dropped
		expect(diff.removed).toEqual(['ds-1']);  // removal queued for IDB delete
	});

	it('updateActiveDatasetConfig marks the active dataset dirty', () => {
		const { facade } = makeFacade();
		facade.addDataset({ id: 'ds-A', dados: [{ a: 1 }], colunas: [], configGraficos: {} });
		facade.clearDirtyDatasetIds();

		facade.updateActiveDatasetConfig({ bar: { color: '#abc' } });

		expect(facade.getDirtyDatasetIds()).toEqual({ dirty: ['ds-A'], removed: [] });
	});

	it('updateActiveDatasetColumns marks the active dataset dirty', () => {
		const { facade } = makeFacade();
		facade.addDataset({ id: 'ds-B', dados: [{ a: 1 }], colunas: [], colunasSelecionadas: [] });
		facade.clearDirtyDatasetIds();

		facade.updateActiveDatasetColumns(['a']);

		expect(facade.getDirtyDatasetIds()).toEqual({ dirty: ['ds-B'], removed: [] });
	});

	it('normalizeActiveDatasetConfig marks the active dataset dirty', () => {
		const { facade } = makeFacade();
		facade.addDataset({ id: 'ds-C', dados: [{ a: 1 }], colunas: [], configGraficos: {} });
		facade.clearDirtyDatasetIds();

		facade.normalizeActiveDatasetConfig(cfg => ({ ...cfg, bar: { enabled: true } }));

		expect(facade.getDirtyDatasetIds()).toEqual({ dirty: ['ds-C'], removed: [] });
	});

	it('setActiveDataset does NOT mark anything dirty (activeIndex change is panel-singleton territory)', () => {
		const { facade } = makeFacade();
		facade.addDataset({ id: 'ds-1', dados: [{}], colunas: [] });
		facade.addDataset({ id: 'ds-2', dados: [{}], colunas: [] });
		facade.clearDirtyDatasetIds();

		facade.setActiveDataset(1);

		expect(facade.getDirtyDatasetIds()).toEqual({ dirty: [], removed: [] });
	});

	it('add-then-remove within one debounce window leaves both sets clean for that id', () => {
		const { facade } = makeFacade();
		facade.addDataset({ id: 'ds-throwaway', dados: [{}], colunas: [] });
		expect(facade.getDirtyDatasetIds().dirty).toContain('ds-throwaway');

		facade.removeDataset(0);
		const diff = facade.getDirtyDatasetIds();
		// Dirty was cancelled; removed is set so a leftover IDB record (if any from
		// a prior session) gets cleaned up. delete() on a missing key is a no-op.
		expect(diff.dirty).not.toContain('ds-throwaway');
		expect(diff.removed).toEqual(['ds-throwaway']);
	});

	it('clearDirtyDatasetIds drains both sets', () => {
		const { facade } = makeFacade();
		facade.addDataset({ id: 'ds-1', dados: [{}], colunas: [] });
		facade.addDataset({ id: 'ds-2', dados: [{}], colunas: [] });
		facade.removeDataset(0);

		expect(facade.getDirtyDatasetIds().dirty.length + facade.getDirtyDatasetIds().removed.length).toBeGreaterThan(0);

		facade.clearDirtyDatasetIds();
		expect(facade.getDirtyDatasetIds()).toEqual({ dirty: [], removed: [] });
	});

	it('updates that touch a dataset multiple times keep a single id in the dirty set', () => {
		const { facade } = makeFacade();
		facade.addDataset({ id: 'ds-1', dados: [{}], colunas: [], configGraficos: {} });
		facade.updateActiveDatasetConfig({ a: 1 });
		facade.updateActiveDatasetConfig({ b: 2 });
		facade.updateActiveDatasetColumns(['a']);

		expect(facade.getDirtyDatasetIds().dirty).toEqual(['ds-1']);
	});
});
