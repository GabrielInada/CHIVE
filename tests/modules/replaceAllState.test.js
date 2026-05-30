// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	addDataset,
	getActiveDataset,
	getAllDatasets,
	getPanelBlocks,
	getPanelCharts,
	getState,
	onStateChange,
	replaceAllState,
	STATE_EVENTS,
} from '../../src/modules/state/appState.js';

function makeDataset(overrides = {}) {
	return {
		id: 'fixed-id',
		name: 'a.csv',
		rows: [{ x: 1 }],
		columns: [{ name: 'x', type: 'number' }],
		selectedColumns: ['x'],
		chartConfig: {},
		...overrides,
	};
}

function resetAppStateForTest() {
	replaceAllState({
		data: { datasets: [], activeIndex: -1 },
		panel: { charts: [], slots: {}, layout: 'template-2col', blocks: [], nextBlockId: 1, nextChartId: 0 },
		ui: { sidebarMode: 'data', previewRows: 10 },
	});
}

describe('replaceAllState()', () => {
	beforeEach(() => {
		resetAppStateForTest();
	});

	it('replaces datasets, activeIndex, panel, and ui in one shot', () => {
		replaceAllState({
			data: {
				datasets: [makeDataset({ id: 'a' }), makeDataset({ id: 'b', name: 'b.csv' })],
				activeIndex: 1,
			},
			panel: {
				charts: [{ id: 0, type: 'bar', config: {}, dataSnapshot: [], columnsSnapshot: [] }],
				slots: { 'slot-1': 0 },
				layout: 'template-3col',
				blocks: [{ id: 7, templateId: 'template-3col', slots: { 'slot-1': 0 }, proportions: { a: 33, b: 33, c: 34 } }],
				nextBlockId: 8,
				nextChartId: 1,
			},
			ui: {
				sidebarMode: 'panel',
				previewRows: 25,
			},
		});

		expect(getAllDatasets()).toHaveLength(2);
		expect(getState().data.activeIndex).toBe(1);
		expect(getActiveDataset().id).toBe('b');

		expect(getPanelCharts()).toHaveLength(1);
		expect(getState().panel.layout).toBe('template-3col');
		expect(getPanelBlocks()).toHaveLength(1);
		expect(getPanelBlocks()[0].id).toBe(7);

		expect(getState().ui.sidebarMode).toBe('panel');
		expect(getState().ui.previewRows).toBe(25);
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
		expect(getState().data.activeIndex).toBe(-1);
	});

	it('falls back to a default block when persisted blocks are empty', () => {
		replaceAllState({ panel: { blocks: [] } });
		expect(getPanelBlocks().length).toBeGreaterThan(0);
	});

	it('ignores invalid sidebarMode and previewRows values', () => {
		// Seed valid values first.
		addDataset(makeDataset());
		const initialMode = getState().ui.sidebarMode;
		const initialRows = getState().ui.previewRows;

		replaceAllState({
			ui: { sidebarMode: 'not-a-mode', previewRows: 0 },
		});

		expect(getState().ui.sidebarMode).toBe(initialMode);
		expect(getState().ui.previewRows).toBe(initialRows);
	});

	it('addDataset stamps an id on datasets that lack one', () => {
		const idx = addDataset({
			name: 'x.csv',
			rows: [],
			columns: [],
			selectedColumns: [],
			chartConfig: {},
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
