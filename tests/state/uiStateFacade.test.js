import { describe, expect, it, vi } from 'vitest';
import { createUiStateFacade } from '../../src/state/uiStateFacade.js';

describe('uiStateFacade', () => {
	it('changes sidebar mode and emits event', () => {
		const emitStateChange = vi.fn();
		const appState = {
			ui: { sidebarMode: 'data', previewRows: 10 },
		};
		const facade = createUiStateFacade({ appState, emitStateChange });

		facade.setSidebarMode('viz');

		expect(appState.ui.sidebarMode).toBe('viz');
		expect(emitStateChange).toHaveBeenCalledWith('sidebarModeChanged', 'viz');
	});

	it('rejects invalid sidebar mode', () => {
		const emitStateChange = vi.fn();
		const appState = {
			ui: { sidebarMode: 'data', previewRows: 10 },
		};
		const facade = createUiStateFacade({ appState, emitStateChange });

		expect(() => facade.setSidebarMode('invalid')).toThrow();
	});

	it('does not emit when setting same sidebar mode', () => {
		const emitStateChange = vi.fn();
		const appState = {
			ui: { sidebarMode: 'data', previewRows: 10 },
		};
		const facade = createUiStateFacade({ appState, emitStateChange });

		facade.setSidebarMode('data');

		expect(emitStateChange).not.toHaveBeenCalled();
	});

	it('sets preview rows and emits event', () => {
		const emitStateChange = vi.fn();
		const appState = {
			ui: { sidebarMode: 'data', previewRows: 10 },
		};
		const facade = createUiStateFacade({ appState, emitStateChange });

		facade.setPreviewRows(25);

		expect(appState.ui.previewRows).toBe(25);
		expect(emitStateChange).toHaveBeenCalledWith('previewRowsChanged', 25);
	});

	it('getPreviewRows returns the committed preview-row count', () => {
		const emitStateChange = vi.fn();
		const appState = {
			ui: { sidebarMode: 'data', previewRows: 10 },
		};
		const facade = createUiStateFacade({ appState, emitStateChange });

		expect(facade.getPreviewRows()).toBe(10);
		facade.setPreviewRows(25);
		expect(facade.getPreviewRows()).toBe(25);
	});

	it('rejects preview rows outside the integer range', () => {
		const emitStateChange = vi.fn();
		const appState = {
			ui: { sidebarMode: 'data', previewRows: 10 },
		};
		const facade = createUiStateFacade({ appState, emitStateChange });

		expect(() => facade.setPreviewRows(0)).toThrow('integer from 1 to 1000');
		expect(() => facade.setPreviewRows(-5)).toThrow('integer from 1 to 1000');
		expect(() => facade.setPreviewRows(1001)).toThrow('integer from 1 to 1000');
		expect(() => facade.setPreviewRows(1.5)).toThrow('integer from 1 to 1000');
		expect(() => facade.setPreviewRows('25')).toThrow('integer from 1 to 1000');
		expect(() => facade.setPreviewRows(NaN)).toThrow('integer from 1 to 1000');
		expect(appState.ui.previewRows).toBe(10);
		expect(emitStateChange).not.toHaveBeenCalled();
	});

	it('does not emit when preview rows are unchanged', () => {
		const emitStateChange = vi.fn();
		const appState = {
			ui: { sidebarMode: 'data', previewRows: 10 },
		};
		const facade = createUiStateFacade({ appState, emitStateChange });

		facade.setPreviewRows(10);
		expect(emitStateChange).not.toHaveBeenCalled();
	});
});
