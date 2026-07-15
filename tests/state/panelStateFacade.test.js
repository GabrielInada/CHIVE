import { describe, expect, it, vi } from 'vitest';
import { createPanelStateFacade } from '../../src/state/panelStateFacade.js';

function createPanelBlockFactory(appState) {
	return (templateId = 'template-2col') => {
		const id = `block-${appState.panel.nextBlockId++}`;
		return {
			id,
			templateId,
			slots: {},
			proportions: { split: 50 },
			heightPx: null,
			borderEnabled: false,
			borderColor: '#5d645d',
		};
	};
}

describe('panelStateFacade', () => {
	it('adds chart snapshot and emits chartAdded', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [], activeIndex: -1 },
			panel: {
				charts: [],
				slots: {},
				layout: 'template-2col',
				blocks: [],
				nextBlockId: 1,
				nextChartId: 0,
			},
			ui: {},
		};
		const createPanelBlock = createPanelBlockFactory(appState);
		const ensureDefaultPanelBlock = () => {
			if (!Array.isArray(appState.panel.blocks)) appState.panel.blocks = [];
			if (appState.panel.blocks.length === 0) appState.panel.blocks.push(createPanelBlock('template-2col'));
		};

		const facade = createPanelStateFacade({
			appState,
			emitStateChange,
			createPanelBlock,
			ensureDefaultPanelBlock,
			sanitizeChartName: name => String(name).trim(),
			panelBlockLimit: 4,
			panelBlockMinHeight: 220,
			panelBlockMaxHeight: 760,
		});

		const id = facade.addChartSnapshot({ name: ' A ', svgMarkup: '<svg/>' });

		expect(id).toBe(0);
		expect(facade.getChartSnapshot(0)?.name).toBe('A');
		expect(emitStateChange).toHaveBeenCalledWith('chartAdded', expect.objectContaining({ id: 0 }));
	});

	it('removes chart snapshot and emits chartRemoved', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [], activeIndex: -1 },
			panel: {
				charts: [],
				slots: {},
				layout: 'template-2col',
				blocks: [],
				nextBlockId: 1,
				nextChartId: 0,
			},
			ui: {},
		};
		const createPanelBlock = createPanelBlockFactory(appState);
		const ensureDefaultPanelBlock = () => {
			if (!Array.isArray(appState.panel.blocks)) appState.panel.blocks = [];
			if (appState.panel.blocks.length === 0) appState.panel.blocks.push(createPanelBlock());
		};

		const facade = createPanelStateFacade({
			appState,
			emitStateChange,
			createPanelBlock,
			ensureDefaultPanelBlock,
			sanitizeChartName: name => String(name).trim(),
			panelBlockLimit: 4,
			panelBlockMinHeight: 220,
			panelBlockMaxHeight: 760,
		});

		const id = facade.addChartSnapshot({ name: 'Test', svgMarkup: '<svg/>' });
		emitStateChange.mockClear();

		facade.removeChartSnapshot(id);
		expect(facade.getChartSnapshot(id)).toBeNull();
		expect(emitStateChange).toHaveBeenCalledWith('chartRemoved', id);
	});

	it('exposes panel charts via getPanelCharts', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [], activeIndex: -1 },
			panel: {
				charts: [{ id: 0, name: 'X' }],
				slots: { 'slot-1': 0 },
				layout: 'template-3col',
				blocks: [],
				nextBlockId: 1,
				nextChartId: 1,
			},
			ui: {},
		};
		const createPanelBlock = createPanelBlockFactory(appState);
		const ensureDefaultPanelBlock = () => {
			if (!Array.isArray(appState.panel.blocks)) appState.panel.blocks = [];
			if (appState.panel.blocks.length === 0) appState.panel.blocks.push(createPanelBlock());
		};

		const facade = createPanelStateFacade({
			appState,
			emitStateChange,
			createPanelBlock,
			ensureDefaultPanelBlock,
			sanitizeChartName: name => String(name).trim(),
			panelBlockLimit: 4,
			panelBlockMinHeight: 220,
			panelBlockMaxHeight: 760,
		});

		expect(facade.getPanelCharts()).toEqual([{ id: 0, name: 'X' }]);
	});

	it('clears panel and emits panelCleared', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [], activeIndex: -1 },
			panel: {
				charts: [{ id: 0, name: 'A' }],
				slots: { 'slot-1': 0 },
				layout: 'template-2col',
				blocks: [],
				nextBlockId: 1,
				nextChartId: 1,
			},
			ui: {},
		};
		const createPanelBlock = createPanelBlockFactory(appState);
		const ensureDefaultPanelBlock = () => {
			if (!Array.isArray(appState.panel.blocks)) appState.panel.blocks = [];
			if (appState.panel.blocks.length === 0) appState.panel.blocks.push(createPanelBlock());
		};

		const facade = createPanelStateFacade({
			appState,
			emitStateChange,
			createPanelBlock,
			ensureDefaultPanelBlock,
			sanitizeChartName: name => String(name).trim(),
			panelBlockLimit: 4,
			panelBlockMinHeight: 220,
			panelBlockMaxHeight: 760,
		});

		facade.clearPanel();
		expect(appState.panel.charts).toEqual([]);
		expect(emitStateChange).toHaveBeenCalledWith('panelCleared');
	});

	it('getPanelBlocks ensures default block exists', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [], activeIndex: -1 },
			panel: {
				charts: [],
				slots: {},
				layout: 'template-2col',
				blocks: [],
				nextBlockId: 1,
				nextChartId: 0,
			},
			ui: {},
		};
		const createPanelBlock = createPanelBlockFactory(appState);
		const ensureDefaultPanelBlock = () => {
			if (!Array.isArray(appState.panel.blocks)) appState.panel.blocks = [];
			if (appState.panel.blocks.length === 0) appState.panel.blocks.push(createPanelBlock());
		};

		const facade = createPanelStateFacade({
			appState,
			emitStateChange,
			createPanelBlock,
			ensureDefaultPanelBlock,
			sanitizeChartName: name => String(name).trim(),
			panelBlockLimit: 4,
			panelBlockMinHeight: 220,
			panelBlockMaxHeight: 760,
		});

		const blocks = facade.getPanelBlocks();
		expect(blocks.length).toBe(1);
		expect(blocks[0].id).toBe('block-1');
	});

	it('respects panel block limit', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [], activeIndex: -1 },
			panel: {
				charts: [],
				slots: {},
				layout: 'template-2col',
				blocks: [],
				nextBlockId: 1,
				nextChartId: 0,
			},
			ui: {},
		};
		const createPanelBlock = createPanelBlockFactory(appState);
		const ensureDefaultPanelBlock = () => {
			if (!Array.isArray(appState.panel.blocks)) appState.panel.blocks = [];
			if (appState.panel.blocks.length === 0) appState.panel.blocks.push(createPanelBlock('template-2col'));
		};

		const facade = createPanelStateFacade({
			appState,
			emitStateChange,
			createPanelBlock,
			ensureDefaultPanelBlock,
			sanitizeChartName: name => String(name).trim(),
			panelBlockLimit: 1,
			panelBlockMinHeight: 220,
			panelBlockMaxHeight: 760,
		});

		const added = facade.addPanelBlock('template-2col');

		expect(added).toBeNull();
		expect(appState.panel.blocks.length).toBe(1);
		expect(emitStateChange).not.toHaveBeenCalledWith('panelBlockAdded', expect.anything());
	});
});
