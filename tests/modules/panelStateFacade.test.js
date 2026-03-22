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
