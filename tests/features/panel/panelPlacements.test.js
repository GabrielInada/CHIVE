// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as state from '../../../src/state/appState.js';
import { addChartToPanel, initPanelController, renderCanvasPanel, renderSidebarPanel, _resetPanelControllerForTesting } from '../../../src/features/panel/panelController.js';
import { setLocale } from '../../../src/services/i18nService.js';
import { mountSlot, updateSlotSnapshot } from '../../../src/features/panel/slots/lifecycle.js';

vi.mock('../../../src/features/panel/slots/lifecycle.js', () => ({
	mountSlot: vi.fn(), updateSlotSnapshot: vi.fn(), teardownAllSlots: vi.fn(), teardownSlot: vi.fn(),
}));
let blockId;
let chartId;
const slot = id => document.querySelector(`[data-panel-slot="${id}"]`);
const filterSouth = () => state.updateActiveDatasetConfig({ globalFilter: {
	rules: [{ column: 'region', mode: 'categorical', include: ['v:South'], exclude: [] }], combine: 'AND',
} });

beforeEach(async () => {
	await setLocale('en');
	_resetPanelControllerForTesting();
	state.applyStateSnapshot({ data: { datasets: [], activeIndex: -1 }, panel: { charts: [], blocks: [] } });
	document.body.innerHTML = '<div id="panel-chart-list"></div><div id="panel-layout-canvas"></div>';
	window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
	vi.stubGlobal('scrollTo', vi.fn());
	state.addDataset({ id: 'sales', name: 'Sales.csv', rows: [{ region: 'North' }, { region: 'South' }], columns: [{ name: 'region', type: 'text' }], chartConfig: {} });
	chartId = addChartToPanel('Sales', { type: 'bar' }).chartId;
	blockId = state.getPanelBlocks()[0].id;
	state.assignChartToPanelBlockSlot(blockId, 'slot-1', chartId);
	state.assignChartToPanelBlockSlot(blockId, 'slot-2', chartId);
	initPanelController();
	renderSidebarPanel();
	renderCanvasPanel();
	vi.clearAllMocks();
});
afterEach(() => {
	document.querySelector('.chart-expanded-close')?.click();
	_resetPanelControllerForTesting();
	vi.unstubAllGlobals();
});

describe('panel placement controls and rendering', () => {
	it('keeps a native labeled checkbox focused and the sidebar unchanged after toggles and filters', () => {
		const checkbox = slot('slot-1').querySelector('input');
		const sidebar = document.querySelector('.panel-item');
		expect(checkbox.type).toBe('checkbox');
		expect(checkbox.labels).toHaveLength(1);
		expect(checkbox.checked).toBe(false);
		expect(checkbox.disabled).toBe(false);
		expect(document.getElementById(checkbox.getAttribute('aria-describedby')).textContent).toContain('Sales.csv');
		checkbox.focus();
		checkbox.click();
		filterSouth();
		expect(document.activeElement).toBe(checkbox);
		expect(checkbox.checked).toBe(true);
		expect(document.querySelector('.panel-item')).toBe(sidebar);
		expect(mountSlot).not.toHaveBeenCalled();
		const live = updateSlotSnapshot.mock.calls.filter(([element]) => element === slot('slot-1').querySelector('.panel-chart-container')).at(-1)[1];
		expect(live.dataSnapshot).toEqual([{ region: 'South' }]);
		expect(slot('slot-2').querySelector('input').checked).toBe(false);
	});

	it('keeps previews inert while drag and removal remain available', () => {
		const article = document.querySelector('.panel-item');
		expect(article.draggable).toBe(true);
		expect(article.querySelector('.panel-item-preview').hasAttribute('inert')).toBe(true);
		const setData = vi.fn();
		const drag = new Event('dragstart');
		Object.defineProperty(drag, 'dataTransfer', { value: { setData } });
		article.dispatchEvent(drag);
		expect(setData).toHaveBeenCalledWith('text/panel-chart-id', chartId);
		article.querySelector('button').click();
		expect(state.getPanelCharts()).toEqual([]);
	});

	it('updates the expanded view and freezes it when the source disappears', () => {
		slot('slot-1').querySelector('input').click();
		slot('slot-1').querySelector('.panel-slot-expand').click();
		filterSouth();
		expect(mountSlot.mock.calls.at(-1)[1].dataSnapshot).toEqual([{ region: 'South' }]);
		state.removeDataset(0);
		expect(slot('slot-1').querySelector('input').disabled).toBe(true);
		expect(slot('slot-1').querySelector('input').checked).toBe(false);
		expect(mountSlot.mock.calls.at(-1)[1].dataSnapshot).toEqual([{ region: 'South' }]);
	});

	it('explains legacy charts and routes slot drops through an atomic swap', () => {
		const legacy = state.addChartSnapshot({ name: 'Old chart' });
		state.assignChartToPanelBlockSlot(blockId, 'slot-2', legacy);
		expect(slot('slot-2').querySelector('input').disabled).toBe(true);
		expect(slot('slot-2').querySelector('.panel-follow-help').textContent).toContain('Visualizations');
		slot('slot-1').querySelector('input').click();
		const event = new Event('drop', { cancelable: true });
		Object.defineProperty(event, 'dataTransfer', { value: { getData: key => ({
			'text/panel-chart-id': String(chartId), 'text/panel-slot-id': 'slot-1', 'text/panel-block-id': blockId,
		})[key] || '' } });
		slot('slot-2').dispatchEvent(event);
		expect(state.getPanelPlacement(blockId, 'slot-2').followGlobalFilter).toBe(true);
		expect(state.getPanelPlacement(blockId, 'slot-1').snapshot.id).toBe(legacy);
	});
});
