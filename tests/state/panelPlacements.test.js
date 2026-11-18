// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as state from '../../src/state/appState.js';
import { addChartToPanel } from '../../src/features/panel/panelController.js';
import { SUPPORTED_PANEL_CHART_TYPES } from '../../src/charts/registries/panel.js';

const rows = [{ region: 'North', sales: 100 }, { region: 'South', sales: 200 }, { region: 'East', sales: 300 }];
const columns = [{ name: 'region', type: 'text' }, { name: 'sales', type: 'number' }];
const category = value => ({ rules: [{ column: 'region', mode: 'categorical', include: [`v:${value}`], exclude: [] }], combine: 'AND' });
const filter = globalFilter => state.updateActiveDatasetConfig({ globalFilter });
let blockId;
let chartId;
let unsubscribe;
const placement = (slot = 'slot-1', block = blockId) => state.getPanelPlacement(block, slot);
const follow = (enabled = true, slot = 'slot-1', block = blockId) => state.setPanelPlacementFollowGlobalFilter(block, slot, enabled);

beforeEach(() => {
	state.applyStateSnapshot({ data: { datasets: [], activeIndex: -1 }, panel: { charts: [], blocks: [] } });
	state.addDataset({ id: 'source-a', name: 'Sales.csv', rows: structuredClone(rows), columns: structuredClone(columns), chartConfig: {} });
	filter(category('North'));
	chartId = addChartToPanel('Saved sales', { type: 'bar' }).chartId;
	blockId = state.getPanelBlocks()[0].id;
	state.assignChartToPanelBlockSlot(blockId, 'slot-1', chartId);
	state.assignChartToPanelBlockSlot(blockId, 'slot-2', chartId);
});
afterEach(() => unsubscribe?.());

describe('independent panel placements', () => {
	it('defaults to frozen; widens from the full source without changing the sidebar or another slot', () => {
		const original = state.getChartSnapshot(chartId);
		expect(original.sourceDatasetId).toBe('source-a');
		expect(placement().followGlobalFilter).toBe(false);
		follow();
		filter({ rules: [] });
		expect(placement().snapshot.dataSnapshot).toEqual(rows);
		expect(placement('slot-2').snapshot).toBe(original);
		expect(original.dataSnapshot).toEqual([rows[0]]);
		expect(placement().snapshot.dataSnapshot).not.toBe(state.getActiveDataset().rows);
		expect(placement().snapshot.dataSnapshot[0]).not.toBe(state.getActiveDataset().rows[0]);
	});

	it('freezes the latest view on disable and reconnects on enable', () => {
		follow();
		filter(category('South'));
		follow(false);
		const frozen = placement().snapshot.dataSnapshot;
		filter(category('East'));
		expect(placement().snapshot.dataSnapshot).toBe(frozen);
		expect(frozen).toEqual([rows[1]]);
		follow();
		expect(placement().snapshot.dataSnapshot).toEqual([rows[2]]);
	});

	it('handles numeric and categorical filters, including zero matches', () => {
		follow();
		filter({ rules: [{ column: 'sales', mode: 'numeric', min: 200, max: 300 }], combine: 'AND' });
		expect(placement().snapshot.dataSnapshot).toEqual(rows.slice(1));
		filter(category('Unknown'));
		expect(placement().snapshot.dataSnapshot).toEqual([]);
		follow(false);
		filter({ rules: [] });
		expect(placement().snapshot.dataSnapshot).toEqual([]);
	});

	it('keeps sources independent across active-dataset changes', () => {
		follow();
		state.addDataset({ id: 'source-b', name: 'Other.csv', rows: [{ region: 'Other', sales: 999 }], columns, chartConfig: {} });
		state.setActiveDataset(1);
		const otherChart = addChartToPanel('Other', { type: 'bar' }).chartId;
		state.assignChartToPanelBlockSlot(blockId, 'slot-2', otherChart);
		follow(true, 'slot-2');
		filter(category('No matches'));
		expect(placement().snapshot.dataSnapshot).toEqual([rows[0]]);
		expect(placement('slot-2').snapshot.dataSnapshot).toEqual([]);
		state.setActiveDataset(0);
		filter(category('South'));
		expect(placement().snapshot.dataSnapshot).toEqual([rows[1]]);
		expect(placement('slot-2').snapshot.dataSnapshot).toEqual([]);
	});

	it('refreshes current column formats while retaining saved chart settings and local filters', () => {
		follow();
		const config = placement().snapshot.config;
		state.updateActiveDatasetConfig({ bar: { ...state.getActiveDataset().chartConfig.bar, color: '#ff0000', customTitle: 'Later title' } });
		expect(placement().snapshot.config).toBe(config);
		const result = state.setDatasetColumnCurrency('source-a', 'sales', { currency: 'USD' });
		expect(result.ok).toBe(true);
		expect(placement().snapshot.columnsSnapshot[1].currency).toBe('USD');
		expect(placement('slot-2').snapshot.columnsSnapshot[1].currency).toBeUndefined();
		expect(placement().snapshot.config).toBe(config);
	});

	it('freezes before source removal and never links a reupload by name', () => {
		follow();
		filter(category('South'));
		state.removeDataset(0);
		expect(placement()).toMatchObject({ followGlobalFilter: false, sourceStatus: 'missing' });
		expect(placement().snapshot.dataSnapshot).toEqual([rows[1]]);
		expect(state.getPanelCharts()).toHaveLength(1);
		state.addDataset({ name: 'Sales.csv', rows, columns, chartConfig: {} });
		follow();
		expect(placement().sourceStatus).toBe('missing');
		expect(placement().followGlobalFilter).toBe(false);
	});

	it('treats legacy snapshots as frozen and rejects unavailable toggles', () => {
		const legacy = state.addChartSnapshot({ name: 'Legacy', type: 'bar', dataSnapshot: rows, columnsSnapshot: columns });
		state.assignChartToPanelBlockSlot(blockId, 'slot-1', legacy);
		follow();
		expect(placement()).toMatchObject({ followGlobalFilter: false, sourceStatus: 'unlinked' });
		expect(placement().snapshot.dataSnapshot).toEqual(rows);
	});

	it('atomically swaps the complete placements even with the same chart ID', () => {
		follow();
		filter(category('South'));
		const observed = [];
		unsubscribe = state.onStateChange(state.STATE_EVENTS.PANEL_BLOCK_SLOT_ASSIGNED, () => {
			observed.push([placement().followGlobalFilter, placement('slot-2').followGlobalFilter]);
		});
		state.movePanelPlacement(blockId, 'slot-1', blockId, 'slot-2');
		expect(observed).toEqual([[false, true]]);
		expect(placement().snapshot.dataSnapshot).toEqual([rows[0]]);
		expect(placement('slot-2').snapshot.dataSnapshot).toEqual([rows[1]]);
		const second = state.addPanelBlock('template-single');
		state.movePanelPlacement(blockId, 'slot-2', second, 'slot-1');
		expect(placement('slot-2')).toBeNull();
		expect(placement('slot-1', second).followGlobalFilter).toBe(true);
	});

	it.each(['replace', 'clear', 'template', 'chart', 'block'])('cleans captures on %s', action => {
		follow(true, 'slot-2');
		if (action === 'replace') state.assignChartToPanelBlockSlot(blockId, 'slot-2', chartId);
		if (action === 'clear') state.assignChartToPanelBlockSlot(blockId, 'slot-2', null);
		if (action === 'template') state.setPanelBlockTemplate(blockId, 'template-single');
		if (action === 'chart') state.removeChartSnapshot(chartId);
		if (action === 'block') state.removePanelBlock(blockId);
		expect(state.getPanelBlocks().find(block => block.id === blockId)?.placements?.['slot-2']).toBeUndefined();
		if (action === 'replace') expect(placement('slot-2').snapshot.dataSnapshot).toEqual([rows[0]]);
	});

	it('reconciles live and missing sources before the single hydration event without mutating its input', () => {
		follow();
		const saved = state.getState();
		saved.data.datasets[0].chartConfig.globalFilter = category('East');
		const listener = vi.fn(() => expect(placement().snapshot.dataSnapshot).toEqual([rows[2]]));
		unsubscribe = state.onStateChange(state.STATE_EVENTS.STATE_HYDRATED, listener);
		state.applyStateSnapshot(saved);
		expect(listener).toHaveBeenCalledTimes(1);
		expect(saved.panel.blocks[0].placements['slot-1'].dataSnapshot).toEqual([rows[0]]);
		unsubscribe();
		state.applyStateSnapshot({ data: { datasets: [] } });
		expect(placement()).toMatchObject({ followGlobalFilter: false, sourceStatus: 'missing' });
		expect(placement().snapshot.dataSnapshot).toEqual([rows[2]]);
	});

	it.each(SUPPORTED_PANEL_CHART_TYPES)('uses the same source contract for %s', type => {
		const id = addChartToPanel(type, { type }).chartId;
		state.assignChartToPanelBlockSlot(blockId, 'slot-1', id);
		follow();
		filter({ rules: [] });
		expect(placement().snapshot.dataSnapshot).toEqual(rows);
		expect(placement().snapshot.config).toBe(state.getChartSnapshot(id).config);
	});
});
