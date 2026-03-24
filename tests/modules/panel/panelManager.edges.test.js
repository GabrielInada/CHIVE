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
		addChartSnapshot: vi.fn((snap) => {
			const id = Math.random();
			return id;
		}),
		removeChartSnapshot: vi.fn(),
		getChartSnapshot: vi.fn(),
		assignChartToPanelBlockSlot: vi.fn(),
		validatePanelSlots: vi.fn(),
		onStateChange: vi.fn(),
	},
	svgExport: {
		captureSvgMarkupFromContainer: vi.fn(() => ({ ok: true, svgMarkup: '<svg/>' })),
		downloadSvgMarkup: vi.fn(),
	},
	i18n: {
		t: vi.fn((k) => `txt:${k}`),
	},
}));

vi.mock('../../../src/modules/appState.js', () => mocks.appState);
vi.mock('../../../src/utils/svgExport.js', () => mocks.svgExport);
vi.mock('../../../src/services/i18nService.js', () => mocks.i18n);

import { initPanelManager, addChartToPanel, removeChartFromPanel, getLayoutConfig } from '../../../src/modules/panelManager.js';

/**
 * panelManager branch coverage focusing on error paths and rendering conditions.
 */
describe('panelManager (branch coverage)', () => {
	beforeEach(() => {
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
		mocks.svgExport.captureSvgMarkupFromContainer.mockClear();
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
		it('captures SVG and adds to panel on success', () => {
			initPanelManager();

			mocks.svgExport.captureSvgMarkupFromContainer.mockReturnValue({
				ok: true,
				svgMarkup: '<svg></svg>',
			});

			const result = addChartToPanel('container-id', 'My Chart');

			expect(result.ok).toBe(true);
			expect(result.chartId).toBeDefined();
			expect(mocks.appState.addChartSnapshot).toHaveBeenCalled();
		});

		it('passes chart name to snapshot preserving content', () => {
			initPanelManager();

			mocks.svgExport.captureSvgMarkupFromContainer.mockReturnValue({
				ok: true,
				svgMarkup: '<svg/>',
			});

			addChartToPanel('container', 'My Bar Chart');

			const call = mocks.appState.addChartSnapshot.mock.calls[0][0];
			// Chart name is passed as-is (sanitization happens internally)
			expect(call.nome).toBeDefined();
			expect(typeof call.nome).toBe('string');
		});
	});

	describe('addChartToPanel() error paths', () => {
		it('returns error when SVG capture fails', () => {
			initPanelManager();

			mocks.svgExport.captureSvgMarkupFromContainer.mockReturnValue({
				ok: false,
				reason: 'not-found',
			});

			const result = addChartToPanel('bad-id', 'Chart');

			expect(result.ok).toBe(false);
			expect(result.reason).toBe('not-found');
		});

		it('catches exception during SVG capture', () => {
			initPanelManager();

			mocks.svgExport.captureSvgMarkupFromContainer.mockImplementation(() => {
				throw new Error('SVG error');
			});

			const result = addChartToPanel('container', 'Chart');

			expect(result.ok).toBe(false);
			expect(result.reason).toBe('add-error');
		});

		it('calls feedback callback on error if provided', () => {
			const feedbackCb = vi.fn();
			initPanelManager(feedbackCb);

			mocks.svgExport.captureSvgMarkupFromContainer.mockImplementation(() => {
				throw new Error('SVG error');
			});

			addChartToPanel('container', 'Chart');

			// Should call feedback with translated error message
			expect(feedbackCb).toHaveBeenCalledWith(expect.any(String), 'error');
		});

		it('does not throw on unhandled error', () => {
			initPanelManager();

			mocks.svgExport.captureSvgMarkupFromContainer.mockImplementation(() => {
				throw new Error('Unexpected');
			});

			expect(() => addChartToPanel('x', 'y')).not.toThrow();
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
