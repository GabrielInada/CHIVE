import { describe, expect, it, vi } from 'vitest';
import { createPanelStateFacade } from '../../src/modules/panelStateFacade.js';

function createPanelBlockFactory(appState) {
	return (templateId = 'layout-2col') => {
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
				layout: 'layout-2col',
				blocks: [],
				nextBlockId: 1,
				nextChartId: 0,
			},
			ui: {},
		};
		const createPanelBlock = createPanelBlockFactory(appState);
		const ensureDefaultPanelBlock = () => {
			if (!Array.isArray(appState.panel.blocks)) appState.panel.blocks = [];
			if (appState.panel.blocks.length === 0) appState.panel.blocks.push(createPanelBlock('layout-2col'));
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

		const id = facade.addChartSnapshot({ nome: ' A ', svgMarkup: '<svg/>' });

		expect(id).toBe(0);
		expect(facade.getChartSnapshot(0)?.nome).toBe('A');
		expect(emitStateChange).toHaveBeenCalledWith('chartAdded', expect.objectContaining({ id: 0 }));
	});

	it('removes chart snapshot and emits chartRemoved', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [], activeIndex: -1 },
			panel: {
				charts: [],
				slots: {},
				layout: 'layout-2col',
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

		const id = facade.addChartSnapshot({ nome: 'Test', svgMarkup: '<svg/>' });
		emitStateChange.mockClear();

		facade.removeChartSnapshot(id);
		expect(facade.getChartSnapshot(id)).toBeNull();
		expect(emitStateChange).toHaveBeenCalledWith('chartRemoved', id);
	});

	it('gets panel charts, slots, and layout', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [], activeIndex: -1 },
			panel: {
				charts: [{ id: 0, nome: 'X' }],
				slots: { 'slot-1': 0 },
				layout: 'layout-3col',
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

		expect(facade.getPanelCharts()).toEqual([{ id: 0, nome: 'X' }]);
		expect(facade.getPanelSlots()).toEqual({ 'slot-1': 0 });
		expect(facade.getPanelLayout()).toBe('layout-3col');
	});

	it('sets panel layout and emits layoutChanged', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [], activeIndex: -1 },
			panel: {
				charts: [],
				slots: {},
				layout: 'layout-2col',
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

		facade.setPanelLayout('layout-1col');
		expect(appState.panel.layout).toBe('layout-1col');
		expect(emitStateChange).toHaveBeenCalledWith('layoutChanged', 'layout-1col');
	});

	it('clears panel and emits panelCleared', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [], activeIndex: -1 },
			panel: {
				charts: [{ id: 0, nome: 'A' }],
				slots: { 'slot-1': 0 },
				layout: 'layout-2col',
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
				layout: 'layout-2col',
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
				layout: 'layout-2col',
				blocks: [],
				nextBlockId: 1,
				nextChartId: 0,
			},
			ui: {},
		};
		const createPanelBlock = createPanelBlockFactory(appState);
		const ensureDefaultPanelBlock = () => {
			if (!Array.isArray(appState.panel.blocks)) appState.panel.blocks = [];
			if (appState.panel.blocks.length === 0) appState.panel.blocks.push(createPanelBlock('layout-2col'));
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

		const added = facade.addPanelBlock('layout-2col');

		expect(added).toBeNull();
		expect(appState.panel.blocks.length).toBe(1);
		expect(emitStateChange).not.toHaveBeenCalledWith('panelBlockAdded', expect.anything());
	});
});
