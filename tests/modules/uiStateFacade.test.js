import { describe, expect, it, vi } from 'vitest';
import { createUiStateFacade } from '../../src/modules/state/uiStateFacade.js';

describe('uiStateFacade', () => {
	it('changes sidebar mode and emits event', () => {
		const emitStateChange = vi.fn();
		const appState = {
			ui: { sidebarMode: 'dados', previewRows: 10 },
		};
		const facade = createUiStateFacade({ appState, emitStateChange });

		facade.setSidebarMode('viz');

		expect(appState.ui.sidebarMode).toBe('viz');
		expect(emitStateChange).toHaveBeenCalledWith('sidebarModeChanged', 'viz');
	});

	it('rejects invalid sidebar mode', () => {
		const emitStateChange = vi.fn();
		const appState = {
			ui: { sidebarMode: 'dados', previewRows: 10 },
		};
		const facade = createUiStateFacade({ appState, emitStateChange });

		expect(() => facade.setSidebarMode('invalid')).toThrow();
	});

	it('does not emit when setting same sidebar mode', () => {
		const emitStateChange = vi.fn();
		const appState = {
			ui: { sidebarMode: 'dados', previewRows: 10 },
		};
		const facade = createUiStateFacade({ appState, emitStateChange });

		facade.setSidebarMode('dados');

		expect(emitStateChange).not.toHaveBeenCalled();
	});

	it('sets preview rows and emits event', () => {
		const emitStateChange = vi.fn();
		const appState = {
			ui: { sidebarMode: 'dados', previewRows: 10 },
		};
		const facade = createUiStateFacade({ appState, emitStateChange });

		facade.setPreviewRows(25);

		expect(appState.ui.previewRows).toBe(25);
		expect(emitStateChange).toHaveBeenCalledWith('previewRowsChanged', 25);
	});

	it('rejects preview rows less than 1', () => {
		const emitStateChange = vi.fn();
		const appState = {
			ui: { sidebarMode: 'dados', previewRows: 10 },
		};
		const facade = createUiStateFacade({ appState, emitStateChange });

		expect(() => facade.setPreviewRows(0)).toThrow('Preview rows must be >= 1');
		expect(() => facade.setPreviewRows(-5)).toThrow('Preview rows must be >= 1');
	});
});
