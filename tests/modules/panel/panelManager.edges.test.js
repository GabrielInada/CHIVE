// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	appState: {
		getPanelCharts: vi.fn(() => []),
		getPanelBlocks: vi.fn(() => [
			{
				id: 'block-1',
				templateId: 'layout-2col',
				slots: {},
				proportions: { split: 50 },
			},
		]),
		getActiveDataset: vi.fn(() => ({
			nome: 'fixture.csv',
			dados: [{ a: 1 }, { a: 2 }],
			colunas: [{ nome: 'a', tipo: 'numero' }],
			colunasSelecionadas: ['a'],
			configGraficos: {},
		})),
		addChartSnapshot: vi.fn((snap) => {
			const id = Math.random();
			return id;
		}),
		removeChartSnapshot: vi.fn(),
		getChartSnapshot: vi.fn(),
		assignChartToPanelBlockSlot: vi.fn(),
		validatePanelSlots: vi.fn(),
		onStateChange: vi.fn(),
		STATE_EVENTS: {
			CHART_ADDED: 'chartAdded',
			CHART_REMOVED: 'chartRemoved',
			PANEL_BLOCK_SLOT_ASSIGNED: 'panelBlockSlotAssigned',
			PANEL_BLOCK_ADDED: 'panelBlockAdded',
			PANEL_BLOCK_REMOVED: 'panelBlockRemoved',
			PANEL_BLOCK_MOVED: 'panelBlockMoved',
			PANEL_BLOCK_TEMPLATE_CHANGED: 'panelBlockTemplateChanged',
			PANEL_BLOCK_PROPORTIONS_UPDATED: 'panelBlockProportionsUpdated',
			PANEL_BLOCK_HEIGHT_UPDATED: 'panelBlockHeightUpdated',
			PANEL_BLOCK_BORDER_UPDATED: 'panelBlockBorderUpdated',
		},
	},
	chartDefaults: {
		mergeChartConfigWithDefaults: vi.fn((cfg) => ({
			bar: { category: 'a', enabled: true },
			scatter: {},
			network: {},
			pie: {},
			bubble: {},
			treemap: {},
			globalFilter: null,
			...(cfg || {}),
		})),
	},
	globalFilter: {
		resolveGlobalFilterForColumns: vi.fn(() => null),
		applyGlobalFilterRules: vi.fn((rows) => rows),
	},
	columnHelpers: {
		getNumericColumnNames: vi.fn(() => ['a']),
	},
	i18n: {
		t: vi.fn((k) => `txt:${k}`),
		getLocale: vi.fn(() => 'en'),
	},
}));

vi.mock('../../../src/modules/appState.js', () => mocks.appState);
vi.mock('../../../src/config/chartDefaults.js', () => mocks.chartDefaults);
vi.mock('../../../src/utils/globalFilter.js', () => mocks.globalFilter);
vi.mock('../../../src/utils/columnHelpers.js', () => mocks.columnHelpers);
vi.mock('../../../src/services/i18nService.js', () => mocks.i18n);

import { initPanelManager, addChartToPanel, removeChartFromPanel, getLayoutConfig, _resetPanelManagerForTesting } from '../../../src/modules/panelManager.js';

/**
 * panelManager branch coverage focusing on error paths and rendering conditions.
 */
describe('panelManager (branch coverage)', () => {
	beforeEach(() => {
		_resetPanelManagerForTesting();

		document.body.innerHTML = `
			<div id="lista-painel-charts"></div>
			<div id="painel-canvas"></div>
			<div id="painel-layout-selector"><select id="select-painel-layout"></select></div>
		`;

		mocks.appState.getPanelCharts.mockClear();
		mocks.appState.getPanelBlocks.mockClear();
		mocks.appState.addChartSnapshot.mockClear();
		mocks.appState.removeChartSnapshot.mockClear();
		mocks.appState.onStateChange.mockClear();
		mocks.appState.getActiveDataset.mockClear();
		mocks.appState.getActiveDataset.mockReturnValue({
			nome: 'fixture.csv',
			dados: [{ a: 1 }, { a: 2 }],
			colunas: [{ nome: 'a', tipo: 'numero' }],
			colunasSelecionadas: ['a'],
			configGraficos: {},
		});
		mocks.chartDefaults.mergeChartConfigWithDefaults.mockClear();
		mocks.globalFilter.resolveGlobalFilterForColumns.mockClear();
		mocks.globalFilter.applyGlobalFilterRules.mockClear();
		mocks.columnHelpers.getNumericColumnNames.mockClear();
		mocks.i18n.t.mockClear();
	});

	describe('initPanelManager()', () => {
		it('registers listeners for chart events', () => {
			initPanelManager();

			const calls = mocks.appState.onStateChange.mock.calls;
			const events = calls.map(([e]) => e);

			expect(events).toContain('chartAdded');
			expect(events).toContain('chartRemoved');
			expect(events).toContain('panelBlockSlotAssigned');
		});

		it('registers listeners for layout events', () => {
			initPanelManager();

			const calls = mocks.appState.onStateChange.mock.calls;
			const events = calls.map(([e]) => e);

			expect(events).toContain('panelBlockAdded');
			expect(events).toContain('panelBlockRemoved');
			expect(events).toContain('panelBlockTemplateChanged');
		});

		it('accepts optional feedback callback', () => {
			const cb = vi.fn();
			expect(() => initPanelManager(cb)).not.toThrow();
		});

		it('handles no feedback callback', () => {
			expect(() => initPanelManager()).not.toThrow();
		});
	});

	describe('addChartToPanel() success path', () => {
		it('builds spec from active dataset and adds to panel on success', () => {
			initPanelManager();

			const result = addChartToPanel('container-id', 'My Chart', { type: 'bar', summary: 'cat: a' });

			expect(result.ok).toBe(true);
			expect(result.chartId).toBeDefined();
			expect(mocks.appState.addChartSnapshot).toHaveBeenCalled();
			const snap = mocks.appState.addChartSnapshot.mock.calls[0][0];
			expect(snap.type).toBe('bar');
			expect(snap.config).toBeDefined();
			expect(Array.isArray(snap.dataSnapshot)).toBe(true);
			expect(Array.isArray(snap.columnsSnapshot)).toBe(true);
		});

		it('passes chart name to snapshot preserving content', () => {
			initPanelManager();

			addChartToPanel('container', 'My Bar Chart', { type: 'bar' });

			const call = mocks.appState.addChartSnapshot.mock.calls[0][0];
			expect(call.nome).toBe('My Bar Chart');
			expect(typeof call.nome).toBe('string');
		});
	});

	describe('addChartToPanel() error paths', () => {
		it('returns unknown-type when metadata.type is missing', () => {
			initPanelManager();

			const result = addChartToPanel('container', 'Chart', null);

			expect(result.ok).toBe(false);
			expect(result.reason).toBe('unknown-type');
		});

		it('returns unknown-type when metadata.type is not a supported renderer', () => {
			initPanelManager();

			const result = addChartToPanel('container', 'Chart', { type: 'sankey' });

			expect(result.ok).toBe(false);
			expect(result.reason).toBe('unknown-type');
		});

		it('returns no-dataset when there is no active dataset', () => {
			initPanelManager();
			mocks.appState.getActiveDataset.mockReturnValueOnce(null);

			const result = addChartToPanel('container', 'Chart', { type: 'bar' });

			expect(result.ok).toBe(false);
			expect(result.reason).toBe('no-dataset');
		});

		it('catches unexpected exceptions and returns add-error', () => {
			initPanelManager();
			mocks.chartDefaults.mergeChartConfigWithDefaults.mockImplementationOnce(() => {
				throw new Error('boom');
			});

			const result = addChartToPanel('container', 'Chart', { type: 'bar' });

			expect(result.ok).toBe(false);
			expect(result.reason).toBe('add-error');
		});

		it('calls feedback callback on add-error if provided', () => {
			const feedbackCb = vi.fn();
			initPanelManager(feedbackCb);
			mocks.chartDefaults.mergeChartConfigWithDefaults.mockImplementationOnce(() => {
				throw new Error('boom');
			});

			addChartToPanel('container', 'Chart', { type: 'bar' });

			expect(feedbackCb).toHaveBeenCalledWith(expect.any(String), 'error');
		});

		it('does not throw on unhandled error', () => {
			initPanelManager();
			mocks.chartDefaults.mergeChartConfigWithDefaults.mockImplementationOnce(() => {
				throw new Error('Unexpected');
			});

			expect(() => addChartToPanel('x', 'y', { type: 'bar' })).not.toThrow();
		});
	});

	describe('removeChartFromPanel()', () => {
		it('removes chart from panel', () => {
			initPanelManager();

			removeChartFromPanel('chart-123');

			expect(mocks.appState.removeChartSnapshot).toHaveBeenCalledWith('chart-123');
		});

		it('handles non-existent chart without error', () => {
			initPanelManager();

			expect(() => removeChartFromPanel('undefined')).not.toThrow();
		});
	});

	describe('getLayoutConfig()', () => {
		it('returns config for valid layout', () => {
			const config = getLayoutConfig('layout-2col');

			expect(config).toBeDefined();
			expect(config.slots).toContain('slot-1');
			expect(config.slots).toContain('slot-2');
		});

		it('defaults to layout-2col for invalid layout', () => {
			const config = getLayoutConfig('invalid');

			expect(config.classe).toContain('2col');
		});

		it('has correct slot counts per layout', () => {
			expect(getLayoutConfig('layout-single').slots.length).toBe(1);
			expect(getLayoutConfig('layout-2col').slots.length).toBe(2);
			expect(getLayoutConfig('layout-hero2').slots.length).toBe(3);
			expect(getLayoutConfig('layout-3col').slots.length).toBe(3);
			expect(getLayoutConfig('layout-1x2').slots.length).toBe(2);
		});

		it('includes translation key for each layout', () => {
			const layouts = ['layout-single', 'layout-2col', 'layout-hero2', 'layout-3col', 'layout-1x2'];
			layouts.forEach((id) => {
				const cfg = getLayoutConfig(id);
				expect(cfg.labelKey).toContain('chive-panel-layout');
			});
		});
	});

	describe('DOM element handling', () => {
		it('handles missing lista-painel-charts', () => {
			initPanelManager();
			document.getElementById('lista-painel-charts')?.remove();
			expect(() => initPanelManager()).not.toThrow();
		});

		it('handles missing painel-canvas', () => {
			initPanelManager();
			document.getElementById('painel-canvas')?.remove();
			expect(() => initPanelManager()).not.toThrow();
		});

		it('handles missing select-painel-layout', () => {
			initPanelManager();
			document.getElementById('select-painel-layout')?.remove();
			expect(() => initPanelManager()).not.toThrow();
		});
	});

	describe('Rendering triggers', () => {
		it('re-renders on chart add (listener callback)', () => {
			initPanelManager();

			// Get the listener for chartAdded
			const chartAddedListener = mocks.appState.onStateChange.mock.calls.find(
				([event]) => event === 'chartAdded'
			)?.[1];

			expect(chartAddedListener).toBeDefined();
			// Listener should be callable without throwing
			expect(() => chartAddedListener?.({})).not.toThrow();
		});

		it('triggers cleanup on panel block removal', () => {
			initPanelManager();

			const blockRemovedListener = mocks.appState.onStateChange.mock.calls.find(
				([event]) => event === 'panelBlockRemoved'
			)?.[1];

			expect(blockRemovedListener).toBeDefined();
		});
	});

	describe('State event handling', () => {
		it('validates slots after template change', () => {
			initPanelManager();

			const templateChangeListener = mocks.appState.onStateChange.mock.calls.find(
				([event]) => event === 'panelBlockTemplateChanged'
			)?.[1];

			expect(templateChangeListener).toBeDefined();
			templateChangeListener?.();

			expect(mocks.appState.validatePanelSlots).toHaveBeenCalled();
		});
	});
});
