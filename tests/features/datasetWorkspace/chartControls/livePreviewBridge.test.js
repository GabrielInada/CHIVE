import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	setLiveRenderCallback,
	triggerLiveRender,
} from '../../../../src/features/datasetWorkspace/chartControls/livePreviewBridge.js';

describe('livePreviewBridge', () => {
	beforeEach(() => {
		setLiveRenderCallback(null);
	});

	it('invokes the registered callback', () => {
		const callback = vi.fn();
		setLiveRenderCallback(callback);

		triggerLiveRender();

		expect(callback).toHaveBeenCalledTimes(1);
	});

	it('is a no-op when no callback is registered', () => {
		expect(() => triggerLiveRender()).not.toThrow();
	});

	it('replaces a previously registered callback', () => {
		const first = vi.fn();
		const second = vi.fn();
		setLiveRenderCallback(first);
		setLiveRenderCallback(second);

		triggerLiveRender();

		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledTimes(1);
	});

	it('disables the callback when passed null or a non-function', () => {
		const callback = vi.fn();

		setLiveRenderCallback(callback);
		setLiveRenderCallback(null);
		triggerLiveRender();
		expect(callback).not.toHaveBeenCalled();

		setLiveRenderCallback(callback);
		setLiveRenderCallback('not a function');
		triggerLiveRender();
		expect(callback).not.toHaveBeenCalled();
	});
});
