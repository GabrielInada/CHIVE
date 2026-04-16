import { describe, expect, it, vi } from 'vitest';
import { createUiStateFacade } from '../../src/modules/uiStateFacade.js';

describe('uiStateFacade', () => {
	it('changes sidebar mode and emits event', () => {
		const emitStateChange = vi.fn();
		const appState = {
			ui: {
				sidebarMode: 'dados',
				previewRows: 10,
				expandedCharts: { bar: false, scatter: false },
			},
		};
		const facade = createUiStateFacade({ appState, emitStateChange });

		facade.setSidebarMode('viz');

		expect(facade.getSidebarMode()).toBe('viz');
		expect(emitStateChange).toHaveBeenCalledWith('sidebarModeChanged', 'viz');
	});

	it('rejects invalid sidebar mode', () => {
		const emitStateChange = vi.fn();
		const appState = {
			ui: {
				sidebarMode: 'dados',
				previewRows: 10,
				expandedCharts: { bar: false, scatter: false },
			},
		};
		const facade = createUiStateFacade({ appState, emitStateChange });

		expect(() => facade.setSidebarMode('invalid')).toThrow();
	});

	it('does not emit when setting same sidebar mode', () => {
		const emitStateChange = vi.fn();
		const appState = {
			ui: {
				sidebarMode: 'dados',
				previewRows: 10,
				expandedCharts: {},
			},
		};
		const facade = createUiStateFacade({ appState, emitStateChange });

		facade.setSidebarMode('dados');

		expect(emitStateChange).not.toHaveBeenCalled();
	});

	it('sets chart expanded state and emits event', () => {
		const emitStateChange = vi.fn();
		const appState = {
			ui: {
				sidebarMode: 'dados',
				previewRows: 10,
				expandedCharts: { bar: false, scatter: false },
			},
		};
		const facade = createUiStateFacade({ appState, emitStateChange });

		facade.setChartExpanded('bar', true);

		expect(facade.getExpandedCharts().bar).toBe(true);
		expect(emitStateChange).toHaveBeenCalledWith('chartExpandedChanged', { chartName: 'bar', expanded: true });
	});

	it('sets preview rows and emits event', () => {
		const emitStateChange = vi.fn();
		const appState = {
			ui: {
				sidebarMode: 'dados',
				previewRows: 10,
				expandedCharts: {},
			},
		};
		const facade = createUiStateFacade({ appState, emitStateChange });

		facade.setPreviewRows(25);

		expect(facade.getPreviewRows()).toBe(25);
		expect(emitStateChange).toHaveBeenCalledWith('previewRowsChanged', 25);
	});

	it('rejects preview rows less than 1', () => {
		const emitStateChange = vi.fn();
		const appState = {
			ui: {
				sidebarMode: 'dados',
				previewRows: 10,
				expandedCharts: {},
			},
		};
		const facade = createUiStateFacade({ appState, emitStateChange });

		expect(() => facade.setPreviewRows(0)).toThrow('Preview rows must be >= 1');
		expect(() => facade.setPreviewRows(-5)).toThrow('Preview rows must be >= 1');
	});
});
