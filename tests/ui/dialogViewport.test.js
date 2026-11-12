// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { observeDialogViewport } from '../../src/ui/dialogViewport.js';
import { showNativeModal } from '../../src/ui/nativeDialog.js';

describe('dialog visible viewport', () => {
	let viewport;
	let frames;
	const flush = () => {
		const callbacks = [...frames.values()];
		frames.clear();
		callbacks.forEach(cb => cb());
	};
	beforeEach(() => {
		viewport = Object.assign(new window.EventTarget(), { height: 800, offsetTop: 0, scale: 1 });
		vi.stubGlobal('visualViewport', viewport);
		vi.stubGlobal('innerHeight', 800);
		frames = new Map();
		let nextFrame = 0;
		vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { frames.set(++nextFrame, cb); return nextFrame; });
		vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => frames.delete(id));
	});
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		document.body.replaceChildren();
	});

	it('fits a keyboard-reduced viewport and follows its vertical offset in one frame', () => {
		const dialog = document.createElement('dialog');
		const input = document.createElement('input');
		input.scrollIntoView = vi.fn();
		dialog.appendChild(input);
		document.body.appendChild(dialog);
		dialog.showModal();
		input.focus();
		const stop = observeDialogViewport(dialog);
		expect(dialog.style.getPropertyValue('--dialog-viewport-height')).toBe('800px');
		viewport.height = 400;
		viewport.offsetTop = 80;
		viewport.dispatchEvent(new Event('resize'));
		viewport.dispatchEvent(new Event('scroll'));
		expect(frames.size).toBe(1);
		flush();
		expect(dialog.style.getPropertyValue('--dialog-viewport-height')).toBe('400px');
		expect(dialog.style.getPropertyValue('--dialog-viewport-top')).toBe('80px');
		expect(dialog.style.getPropertyValue('--dialog-viewport-bottom')).toBe('320px');
		expect(input.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
		stop();
	});

	it('leaves pinch zoom to the browser and resumes sizing when zoom is reset', () => {
		const dialog = document.createElement('dialog');
		const stop = observeDialogViewport(dialog);
		viewport.scale = 2;
		viewport.height = 400;
		viewport.dispatchEvent(new Event('resize'));
		flush();
		expect(dialog.style.getPropertyValue('--dialog-viewport-height')).toBe('');
		viewport.scale = 1;
		viewport.height = 800;
		viewport.dispatchEvent(new Event('resize'));
		flush();
		expect(dialog.style.getPropertyValue('--dialog-viewport-height')).toBe('800px');
		stop();
	});

	it('removes listeners and pending updates when the modal closes', () => {
		const remove = vi.spyOn(viewport, 'removeEventListener');
		const dialog = document.createElement('dialog');
		const modal = showNativeModal(dialog);
		viewport.dispatchEvent(new Event('resize'));
		modal.close();
		flush();
		expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
		expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
		expect(dialog.style.getPropertyValue('--dialog-viewport-height')).toBe('');
	});

	it('uses CSS sizing when VisualViewport is unavailable', () => {
		vi.stubGlobal('visualViewport', undefined);
		const dialog = document.createElement('dialog');
		expect(() => observeDialogViewport(dialog)()).not.toThrow();
		expect(dialog.style.length).toBe(0);
	});
});
