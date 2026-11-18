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
	it('keeps the lock focused and the sidebar unchanged while unlocking and freezing the current view', () => {
		const lock = slot('slot-1').querySelector('[data-panel-follow]');
		const sidebar = document.querySelector('.panel-item');
		expect(lock.tagName).toBe('BUTTON');
		expect(lock.type).toBe('button');
		expect(lock.getAttribute('aria-label')).toBe('Lock chart to current view');
		expect(lock.getAttribute('aria-pressed')).toBe('true');
		expect(lock.getAttribute('aria-disabled')).toBe('false');
		expect(lock.title).toContain('Locked: keeps the current view.');
		expect(document.getElementById(lock.getAttribute('aria-describedby')).textContent).toContain('Sales.csv');
		lock.focus();
		lock.click();
		filterSouth();
		expect(document.activeElement).toBe(lock);
		expect(lock.getAttribute('aria-pressed')).toBe('false');
		expect(lock.title).toContain('Unlocked: follows the global filter.');
		expect(document.querySelector('.panel-item')).toBe(sidebar);
		expect(mountSlot).not.toHaveBeenCalled();
		const live = updateSlotSnapshot.mock.calls.filter(([element]) => element === slot('slot-1').querySelector('.panel-chart-container')).at(-1)[1];
		expect(live.dataSnapshot).toEqual([{ region: 'South' }]);
		expect(slot('slot-2').querySelector('[data-panel-follow]').getAttribute('aria-pressed')).toBe('true');
		lock.click();
		state.updateActiveDatasetConfig({ globalFilter: { rules: [], combine: 'AND' } });
		expect(lock.getAttribute('aria-pressed')).toBe('true');
		expect(state.getPanelPlacement(blockId, 'slot-1').snapshot.dataSnapshot).toEqual([{ region: 'South' }]);
		lock.click();
		expect(state.getPanelPlacement(blockId, 'slot-1').snapshot.dataSnapshot).toEqual([{ region: 'North' }, { region: 'South' }]);
		expect(document.activeElement).toBe(lock);
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
		const lock = slot('slot-1').querySelector('[data-panel-follow]');
		lock.click();
		slot('slot-1').querySelector('.panel-slot-expand').click();
		filterSouth();
		expect(mountSlot.mock.calls.at(-1)[1].dataSnapshot).toEqual([{ region: 'South' }]);
		state.removeDataset(0);
		expect(lock.getAttribute('aria-disabled')).toBe('true');
		expect(lock.getAttribute('aria-pressed')).toBe('true');
		expect(lock.title).toContain('Source unavailable');
		lock.click();
		expect(state.getPanelPlacement(blockId, 'slot-1').followGlobalFilter).toBe(false);
		expect(mountSlot.mock.calls.at(-1)[1].dataSnapshot).toEqual([{ region: 'South' }]);
	});

	it('explains legacy charts and routes slot drops through an atomic swap', () => {
		const legacy = state.addChartSnapshot({ name: 'Old chart' });
		state.assignChartToPanelBlockSlot(blockId, 'slot-2', legacy);
		const legacyLock = slot('slot-2').querySelector('[data-panel-follow]');
		expect(legacyLock.getAttribute('aria-disabled')).toBe('true');
		expect(slot('slot-2').querySelector('.panel-follow-help').textContent).toContain('Visualizations');
		legacyLock.focus();
		expect(document.activeElement).toBe(legacyLock);
		legacyLock.click();
		expect(state.getPanelPlacement(blockId, 'slot-2').followGlobalFilter).toBe(false);
		slot('slot-1').querySelector('[data-panel-follow]').click();
		const event = new Event('drop', { cancelable: true });
		Object.defineProperty(event, 'dataTransfer', { value: { getData: key => ({
			'text/panel-chart-id': String(chartId), 'text/panel-slot-id': 'slot-1', 'text/panel-block-id': blockId,
		})[key] || '' } });
		slot('slot-2').dispatchEvent(event);
		expect(state.getPanelPlacement(blockId, 'slot-2').followGlobalFilter).toBe(true);
		expect(state.getPanelPlacement(blockId, 'slot-1').snapshot.id).toBe(legacy);
	});
});
