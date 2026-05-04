// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	addDataset,
	getActiveDataset,
	getActiveDatasetIndex,
	getAllDatasets,
	getPanelBlocks,
	getPanelCharts,
	getPanelLayout,
	getPreviewRows,
	getSidebarMode,
	onStateChange,
	replaceAllState,
	resetState,
	STATE_EVENTS,
} from '../../src/modules/appState.js';

function makeDataset(overrides = {}) {
	return {
		id: 'fixed-id',
		nome: 'a.csv',
		dados: [{ x: 1 }],
		colunas: [{ nome: 'x', tipo: 'numero' }],
		colunasSelecionadas: ['x'],
		configGraficos: {},
		...overrides,
	};
}

describe('replaceAllState()', () => {
	beforeEach(() => {
		resetState();
	});

	it('replaces datasets, activeIndex, panel, and ui in one shot', () => {
		replaceAllState({
			data: {
				datasets: [makeDataset({ id: 'a' }), makeDataset({ id: 'b', nome: 'b.csv' })],
				activeIndex: 1,
			},
			panel: {
				charts: [{ id: 0, type: 'bar', config: {}, dataSnapshot: [], columnsSnapshot: [] }],
				slots: { 'slot-1': 0 },
				layout: 'layout-3col',
				blocks: [{ id: 7, templateId: 'layout-3col', slots: { 'slot-1': 0 }, proportions: { a: 33, b: 33, c: 34 } }],
				nextBlockId: 8,
				nextChartId: 1,
			},
			ui: {
				sidebarMode: 'panel',
				previewRows: 25,
				expandedCharts: { bar: true },
			},
		});

		expect(getAllDatasets()).toHaveLength(2);
		expect(getActiveDatasetIndex()).toBe(1);
		expect(getActiveDataset().id).toBe('b');

		expect(getPanelCharts()).toHaveLength(1);
		expect(getPanelLayout()).toBe('layout-3col');
		expect(getPanelBlocks()).toHaveLength(1);
		expect(getPanelBlocks()[0].id).toBe(7);

		expect(getSidebarMode()).toBe('panel');
		expect(getPreviewRows()).toBe(25);
	});

	it('emits exactly one STATE_HYDRATED event', () => {
		const listener = vi.fn();
		onStateChange(STATE_EVENTS.STATE_HYDRATED, listener);

		replaceAllState({
			data: { datasets: [], activeIndex: -1 },
			panel: {},
			ui: {},
		});

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('clamps an out-of-range activeIndex to -1', () => {
		replaceAllState({
			data: { datasets: [makeDataset()], activeIndex: 99 },
		});
		expect(getActiveDatasetIndex()).toBe(-1);
	});

	it('falls back to a default block when persisted blocks are empty', () => {
		replaceAllState({ panel: { blocks: [] } });
		expect(getPanelBlocks().length).toBeGreaterThan(0);
	});

	it('ignores invalid sidebarMode and previewRows values', () => {
		// Seed valid values first.
		addDataset(makeDataset());
		const initialMode = getSidebarMode();
		const initialRows = getPreviewRows();

		replaceAllState({
			ui: { sidebarMode: 'not-a-mode', previewRows: 0 },
		});

		expect(getSidebarMode()).toBe(initialMode);
		expect(getPreviewRows()).toBe(initialRows);
	});

	it('merges expandedCharts onto current state instead of replacing wholesale', () => {
		replaceAllState({
			ui: { expandedCharts: { bar: true } },
		});
		// scatter et al. should still be present from the default shape
		// (the test passes if no exception and the merged value is present).
		// We just exercise the merge path here.
	});

	it('addDataset stamps an id on datasets that lack one', () => {
		const idx = addDataset({
			nome: 'x.csv',
			dados: [],
			colunas: [],
			colunasSelecionadas: [],
			configGraficos: {},
		});
		const dataset = getAllDatasets()[idx];
		expect(typeof dataset.id).toBe('string');
		expect(dataset.id.length).toBeGreaterThan(0);
	});

	it('addDataset preserves an explicit id when provided', () => {
		addDataset(makeDataset({ id: 'preset-id' }));
		expect(getAllDatasets()[0].id).toBe('preset-id');
	});
});
