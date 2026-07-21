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

function makeFacade(panelOverrides = {}, { panelBlockLimit = 4 } = {}) {
	const appState = {
		data: { datasets: [], activeIndex: -1 },
		panel: {
			charts: [],
			slots: {},
			layout: 'template-2col',
			blocks: [],
			nextBlockId: 1,
			nextChartId: 0,
			...panelOverrides,
		},
		ui: {},
	};
	const emitStateChange = vi.fn();
	const createPanelBlock = createPanelBlockFactory(appState);
	const syncPanelLayout = () => {
		if (appState.panel.blocks[0]) {
			appState.panel.layout = appState.panel.blocks[0].templateId;
		}
	};
	const ensureDefaultPanelBlock = () => {
		if (!Array.isArray(appState.panel.blocks)) appState.panel.blocks = [];
		if (appState.panel.blocks.length === 0) appState.panel.blocks.push(createPanelBlock('template-2col'));
		syncPanelLayout();
	};
	const facade = createPanelStateFacade({
		appState,
		emitStateChange,
		createPanelBlock,
		ensureDefaultPanelBlock,
		syncPanelLayout,
		sanitizeChartName: name => String(name).trim(),
		panelBlockLimit,
		panelBlockMinHeight: 220,
		panelBlockMaxHeight: 760,
	});
	return { appState, emitStateChange, facade };
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

	it('throws for malformed chart ids and does not emit for a valid missing chart', () => {
		const { emitStateChange, facade } = makeFacade({ charts: [{ id: 0, name: 'A' }], nextChartId: 1 });

		expect(() => facade.removeChartSnapshot(null)).toThrow('Invalid chart id');
		expect(facade.getChartSnapshot(null)).toBeNull();
		emitStateChange.mockClear();
		facade.removeChartSnapshot(99);
		expect(emitStateChange).not.toHaveBeenCalled();
	});

	it('emits block events only for real changes and keeps layout mirrored', () => {
		const first = {
			id: 'block-1', templateId: 'template-3col', slots: {},
			proportions: { a: 33, b: 33, c: 34 }, heightPx: null,
			borderEnabled: false, borderColor: '#5d645d',
		};
		const second = {
			id: 'block-2', templateId: 'template-single', slots: {},
			proportions: { split: 100 }, heightPx: null,
			borderEnabled: false, borderColor: '#5d645d',
		};
		const { appState, emitStateChange, facade } = makeFacade({
			blocks: [first, second],
			layout: 'template-2col',
			nextBlockId: 3,
		});

		facade.removePanelBlock('missing');
		expect(emitStateChange).not.toHaveBeenCalled();
		facade.movePanelBlock('block-1', 0);
		expect(emitStateChange).not.toHaveBeenCalled();

		facade.movePanelBlock('block-2', 0);
		expect(appState.panel.layout).toBe('template-single');
		expect(emitStateChange).toHaveBeenCalledWith('panelBlockMoved', { blockId: 'block-2', targetIndex: 0 });

		emitStateChange.mockClear();
		facade.removePanelBlock('block-2');
		expect(appState.panel.layout).toBe('template-3col');
		expect(emitStateChange).toHaveBeenCalledWith('panelBlockRemoved', 'block-2');
	});

	it('validates templates and suppresses same-template events', () => {
		const block = {
			id: 'block-1', templateId: 'template-2col', slots: {}, proportions: { split: 50 },
			heightPx: null, borderEnabled: false, borderColor: '#5d645d',
		};
		const { appState, emitStateChange, facade } = makeFacade({ blocks: [block], nextBlockId: 2 });

		expect(() => facade.addPanelBlock('unknown')).toThrow('Invalid panel template');
		expect(() => facade.setPanelBlockTemplate('block-1', 'unknown')).toThrow('Invalid panel template');
		expect(facade.setPanelBlockTemplate('block-1', 'template-2col')).toBe(true);
		expect(emitStateChange).not.toHaveBeenCalled();

		expect(facade.setPanelBlockTemplate('block-1', 'template-single')).toBe(true);
		expect(appState.panel.layout).toBe('template-single');
		expect(emitStateChange).toHaveBeenCalledWith('panelBlockTemplateChanged', {
			blockId: 'block-1',
			templateId: 'template-single',
		});
	});

	it('validates slot assignments and suppresses unchanged assignments', () => {
		const block = {
			id: 'block-1', templateId: 'template-2col', slots: {}, proportions: { split: 50 },
			heightPx: null, borderEnabled: false, borderColor: '#5d645d',
		};
		const { emitStateChange, facade } = makeFacade({
			charts: [{ id: 0, name: 'A' }],
			blocks: [block],
			nextBlockId: 2,
			nextChartId: 1,
		});

		expect(() => facade.assignChartToPanelBlockSlot('block-1', 'slot-3', 0)).toThrow('Invalid panel slot');
		facade.assignChartToPanelBlockSlot('block-1', 'slot-1', null);
		expect(emitStateChange).not.toHaveBeenCalled();

		facade.assignChartToPanelBlockSlot('block-1', 'slot-1', '0');
		expect(emitStateChange).toHaveBeenCalledTimes(1);
		emitStateChange.mockClear();
		facade.assignChartToPanelBlockSlot('block-1', 'slot-1', 0);
		expect(emitStateChange).not.toHaveBeenCalled();
	});

	it('emits proportion, height, and border events only after atomic changes', () => {
		const block = {
			id: 'block-1', templateId: 'template-2col', slots: {}, proportions: { split: 50 },
			heightPx: null, borderEnabled: false, borderColor: '#5d645d',
		};
		const { appState, emitStateChange, facade } = makeFacade({ blocks: [block], nextBlockId: 2 });

		facade.updatePanelBlockProportions('block-1', { split: 50 });
		facade.updatePanelBlockBorder('block-1', {});
		expect(emitStateChange).not.toHaveBeenCalled();

		expect(() => facade.updatePanelBlockProportions('block-1', { split: 60, unknown: 10 })).toThrow('proportion key');
		expect(appState.panel.blocks[0].proportions).toEqual({ split: 50 });
		expect(() => facade.updatePanelBlockBorder('block-1', { enabled: true, color: 'bad' })).toThrow('border color');
		expect(appState.panel.blocks[0].borderEnabled).toBe(false);

		facade.updatePanelBlockProportions('block-1', { split: 60 });
		facade.updatePanelBlockHeight('block-1', 100);
		facade.updatePanelBlockBorder('block-1', { enabled: true });
		expect(emitStateChange.mock.calls.map(([event]) => event)).toEqual([
			'panelBlockProportionsUpdated',
			'panelBlockHeightUpdated',
			'panelBlockBorderUpdated',
		]);

		emitStateChange.mockClear();
		facade.updatePanelBlockHeight('block-1', 220);
		facade.updatePanelBlockBorder('block-1', { enabled: true });
		expect(emitStateChange).not.toHaveBeenCalled();
	});
});
