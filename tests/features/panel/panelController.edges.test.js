// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	appState: {
		getPanelCharts: vi.fn(() => []),
		getPanelBlocks: vi.fn(() => [
			{
				id: 'block-1',
				templateId: 'template-2col',
				slots: {},
				proportions: { split: 50 },
			},
		]),
		getActiveDataset: vi.fn(() => ({
			name: 'fixture.csv',
			rows: [{ a: 1 }, { a: 2 }],
			columns: [{ name: 'a', type: 'number' }],
			selectedColumns: ['a'],
			chartConfig: {},
		})),
		addChartSnapshot: vi.fn(() => 'chart-id'),
		removeChartSnapshot: vi.fn(),
		getChartSnapshot: vi.fn(),
		assignChartToPanelBlockSlot: vi.fn(),
		validatePanelSlots: vi.fn(),
		onStateChange: vi.fn(() => () => {}),
		STATE_EVENTS: {
			CHART_ADDED: 'chartAdded',
			CHART_REMOVED: 'chartRemoved',
			PANEL_CLEARED: 'panelCleared',
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
	chartConfig: {
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

vi.mock('../../../src/state/appState.js', () => mocks.appState);
vi.mock('../../../src/domain/charts/chartConfig.js', () => mocks.chartConfig);
vi.mock('../../../src/domain/filters/globalFilter.js', () => mocks.globalFilter);
vi.mock('../../../src/domain/datasets/columns.js', () => mocks.columnHelpers);
vi.mock('../../../src/services/i18nService.js', () => mocks.i18n);

import { initPanelController, addChartToPanel, removeChartFromPanel, getLayoutConfig, _resetPanelControllerForTesting } from '../../../src/features/panel/panelController.js';

/**
 * panelController branch coverage focusing on error paths and rendering conditions.
 */
describe('panelController (branch coverage)', () => {
	beforeEach(() => {
		_resetPanelControllerForTesting();

		// WHY: renderCanvasPanel calls window.matchMedia; jsdom doesn't implement it.
		if (!window.matchMedia) {
			window.matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
		}

		document.body.innerHTML = `
			<div id="panel-chart-list"></div>
			<div id="panel-layout-canvas"></div>
			<div id="panel-layout-selector"><select id="select-panel-layout"></select></div>
		`;

		mocks.appState.getPanelCharts.mockClear();
		mocks.appState.getPanelBlocks.mockClear();
		mocks.appState.addChartSnapshot.mockClear();
		mocks.appState.removeChartSnapshot.mockClear();
		mocks.appState.onStateChange.mockClear();
		mocks.appState.getActiveDataset.mockClear();
		mocks.appState.getActiveDataset.mockReturnValue({
			name: 'fixture.csv',
			rows: [{ a: 1 }, { a: 2 }],
			columns: [{ name: 'a', type: 'number' }],
			selectedColumns: ['a'],
			chartConfig: {},
		});
		mocks.chartConfig.mergeChartConfigWithDefaults.mockClear();
		mocks.globalFilter.resolveGlobalFilterForColumns.mockClear();
		mocks.globalFilter.applyGlobalFilterRules.mockClear();
		mocks.columnHelpers.getNumericColumnNames.mockClear();
		mocks.i18n.t.mockClear();
	});

	describe('initPanelController()', () => {
		it('registers listeners for chart events', () => {
			initPanelController();

			const calls = mocks.appState.onStateChange.mock.calls;
			const events = calls.map(([e]) => e);

			expect(events).toContain('chartAdded');
			expect(events).toContain('chartRemoved');
			expect(events).toContain('panelBlockSlotAssigned');
		});

		it('registers listeners for layout events', () => {
			initPanelController();

			const calls = mocks.appState.onStateChange.mock.calls;
			const events = calls.map(([e]) => e);

			expect(events).toContain('panelBlockAdded');
			expect(events).toContain('panelBlockRemoved');
			expect(events).toContain('panelBlockTemplateChanged');
		});

		it('accepts optional feedback callback', () => {
			const cb = vi.fn();
			expect(() => initPanelController(cb)).not.toThrow();
		});

		it('handles no feedback callback', () => {
			expect(() => initPanelController()).not.toThrow();
		});
	});

	describe('addChartToPanel() success path', () => {
		it('builds spec from active dataset and adds to panel on success', () => {
			initPanelController();

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
			initPanelController();

			addChartToPanel('container', 'My Bar Chart', { type: 'bar' });

			const call = mocks.appState.addChartSnapshot.mock.calls[0][0];
			expect(call.name).toBe('My Bar Chart');
			expect(typeof call.name).toBe('string');
		});

		// Guards the invariant livePreviewRender relies on: panel snapshots are
		// captured by value, so a live color-picker edit of the active config can
		// never mutate an already-added panel chart. (See structuredClone in
		// panelController.addChartToPanel.)
		it('snapshots config by value so later active-config edits do not mutate it', () => {
			initPanelController();
			const liveConfig = { bar: { category: 'a', enabled: true, color: '#111111' } };
			mocks.appState.getActiveDataset.mockReturnValue({
				name: 'fixture.csv',
				rows: [{ a: 1 }],
				columns: [{ name: 'a', type: 'number' }],
				selectedColumns: ['a'],
				chartConfig: liveConfig,
			});

			const result = addChartToPanel('container', 'Chart', { type: 'bar' });
			expect(result.ok).toBe(true);
			const snap = mocks.appState.addChartSnapshot.mock.calls[0][0];
			expect(snap.config.color).toBe('#111111');

			liveConfig.bar.color = '#999999';
			expect(snap.config.color).toBe('#111111');
		});
	});

	describe('addChartToPanel() error paths', () => {
		it('returns unknown-type when metadata.type is missing', () => {
			initPanelController();

			const result = addChartToPanel('container', 'Chart', null);

			expect(result.ok).toBe(false);
			expect(result.reason).toBe('unknown-type');
		});

		it('returns unknown-type when metadata.type is not a supported renderer', () => {
			initPanelController();

			const result = addChartToPanel('container', 'Chart', { type: 'sankey' });

			expect(result.ok).toBe(false);
			expect(result.reason).toBe('unknown-type');
		});

		it('returns no-dataset when there is no active dataset', () => {
			initPanelController();
			mocks.appState.getActiveDataset.mockReturnValueOnce(null);

			const result = addChartToPanel('container', 'Chart', { type: 'bar' });

			expect(result.ok).toBe(false);
			expect(result.reason).toBe('no-dataset');
		});

		it('catches unexpected exceptions and returns add-error', () => {
			initPanelController();
			mocks.chartConfig.mergeChartConfigWithDefaults.mockImplementationOnce(() => {
				throw new Error('boom');
			});

			const result = addChartToPanel('container', 'Chart', { type: 'bar' });

			expect(result.ok).toBe(false);
			expect(result.reason).toBe('add-error');
		});

		it('calls feedback callback on add-error if provided', () => {
			const feedbackCb = vi.fn();
			initPanelController(feedbackCb);
			mocks.chartConfig.mergeChartConfigWithDefaults.mockImplementationOnce(() => {
				throw new Error('boom');
			});

			addChartToPanel('container', 'Chart', { type: 'bar' });

			expect(feedbackCb).toHaveBeenCalledWith(expect.any(String));
		});

		it('does not throw on unhandled error', () => {
			initPanelController();
			mocks.chartConfig.mergeChartConfigWithDefaults.mockImplementationOnce(() => {
				throw new Error('Unexpected');
			});

			expect(() => addChartToPanel('x', 'y', { type: 'bar' })).not.toThrow();
		});
	});

	describe('removeChartFromPanel()', () => {
		it('removes chart from panel', () => {
			initPanelController();

			removeChartFromPanel('chart-123');

			expect(mocks.appState.removeChartSnapshot).toHaveBeenCalledWith('chart-123');
		});

		it('handles non-existent chart without error', () => {
			initPanelController();

			expect(() => removeChartFromPanel('undefined')).not.toThrow();
		});
	});

	describe('getLayoutConfig()', () => {
		it('returns config for valid layout', () => {
			const config = getLayoutConfig('template-2col');

			expect(config).toBeDefined();
			expect(config.slots).toContain('slot-1');
			expect(config.slots).toContain('slot-2');
		});

		it('defaults to template-2col for invalid layout', () => {
			const config = getLayoutConfig('invalid');

			expect(config.cssClass).toContain('2col');
		});

		it('has correct slot counts per layout', () => {
			expect(getLayoutConfig('template-single').slots.length).toBe(1);
			expect(getLayoutConfig('template-2col').slots.length).toBe(2);
			expect(getLayoutConfig('template-hero2').slots.length).toBe(3);
			expect(getLayoutConfig('template-3col').slots.length).toBe(3);
			expect(getLayoutConfig('template-1x2').slots.length).toBe(2);
		});

		it('includes translation key for each layout', () => {
			const layouts = ['template-single', 'template-2col', 'template-hero2', 'template-3col', 'template-1x2'];
			layouts.forEach((id) => {
				const cfg = getLayoutConfig(id);
				expect(cfg.labelKey).toContain('chive-panel-template');
			});
		});
	});

	describe('DOM element handling', () => {
		it('handles missing panel-chart-list', () => {
			initPanelController();
			document.getElementById('panel-chart-list')?.remove();
			expect(() => initPanelController()).not.toThrow();
		});

		it('handles missing panel-layout-canvas', () => {
			initPanelController();
			document.getElementById('panel-layout-canvas')?.remove();
			expect(() => initPanelController()).not.toThrow();
		});

		it('handles missing select-panel-layout', () => {
			initPanelController();
			document.getElementById('select-panel-layout')?.remove();
			expect(() => initPanelController()).not.toThrow();
		});
	});

	describe('Rendering triggers', () => {
		it('re-renders on chart add (listener callback)', () => {
			initPanelController();

			// Get the listener for chartAdded
			const chartAddedListener = mocks.appState.onStateChange.mock.calls.find(
				([event]) => event === 'chartAdded'
			)?.[1];

			expect(chartAddedListener).toBeDefined();
			// Listener should be callable without throwing
			expect(() => chartAddedListener?.({})).not.toThrow();
		});

		it('triggers cleanup on panel block removal', () => {
			initPanelController();

			const blockRemovedListener = mocks.appState.onStateChange.mock.calls.find(
				([event]) => event === 'panelBlockRemoved'
			)?.[1];

			expect(blockRemovedListener).toBeDefined();
		});
	});

	describe('State event handling', () => {
		it('validates slots after template change', () => {
			initPanelController();

			const templateChangeListener = mocks.appState.onStateChange.mock.calls.find(
				([event]) => event === 'panelBlockTemplateChanged'
			)?.[1];

			expect(templateChangeListener).toBeDefined();
			templateChangeListener?.();

			expect(mocks.appState.validatePanelSlots).toHaveBeenCalled();
		});
	});
});
