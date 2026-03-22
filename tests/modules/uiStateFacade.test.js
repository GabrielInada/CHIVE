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
});
