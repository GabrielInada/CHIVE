// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	updateActiveDatasetConfig: vi.fn(),
	normalizeActiveDatasetConfig: vi.fn(),
}));

vi.mock('../../../src/modules/state/appState.js', () => ({
	normalizeActiveDatasetConfig: mocks.normalizeActiveDatasetConfig,
	updateActiveDatasetConfig: mocks.updateActiveDatasetConfig,
}));

import { setupColorInputListener } from '../../../src/modules/chartControls/controlListenerHelpers.js';
import { setLiveRenderCallback } from '../../../src/modules/chartControls/livePreview.js';

describe('controlListenerHelpers setupColorInputListener', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setLiveRenderCallback(null);
		document.body.innerHTML = '<input id="viz-input-bar-color" type="color" value="#000000">';
	});

	function makeDataset(initialColor) {
		return {
			chartConfig: {
				bar: {
					color: initialColor,
				},
			},
		};
	}

	it('routes input writes through the non-emitting facade and triggers a chart-only re-render', () => {
		const dataset = makeDataset('#000000');
		const liveRender = vi.fn();
		setLiveRenderCallback(liveRender);
		setupColorInputListener('viz-input-bar-color', 'color', '#abcdef', dataset, 'bar');

		const input = document.getElementById('viz-input-bar-color');
		input.value = '#ff0000';
		input.dispatchEvent(new Event('input'));

		// No emitting facade call (would rebuild the sidebar and disrupt the picker).
		expect(mocks.updateActiveDatasetConfig).not.toHaveBeenCalled();

		// Non-emitting facade write happened with a normalizer that produces the new color.
		expect(mocks.normalizeActiveDatasetConfig).toHaveBeenCalledTimes(1);
		const normalizer = mocks.normalizeActiveDatasetConfig.mock.calls[0][0];
		const result = normalizer({ bar: { color: '#000000', other: 'keep' } });
		expect(result.bar.color.toLowerCase()).toBe('#ff0000');
		expect(result.bar.other).toBe('keep');

		// Chart-only re-render fired so the user sees the new color live.
		expect(liveRender).toHaveBeenCalledTimes(1);
	});

	it('commits via the emitting facade on the change event', () => {
		const dataset = makeDataset('#000000');
		setupColorInputListener('viz-input-bar-color', 'color', '#abcdef', dataset, 'bar');

		const input = document.getElementById('viz-input-bar-color');
		input.value = '#00ff00';
		input.dispatchEvent(new Event('change'));

		expect(mocks.updateActiveDatasetConfig).toHaveBeenCalledTimes(1);
		const callArg = mocks.updateActiveDatasetConfig.mock.calls[0][0];
		expect(callArg.bar.color.toLowerCase()).toBe('#00ff00');
	});

	it('falls back to the default color when the input value is not a valid hex', () => {
		const dataset = makeDataset('#000000');
		setLiveRenderCallback(vi.fn());
		setupColorInputListener('viz-input-bar-color', 'color', '#abcdef', dataset, 'bar');

		const input = document.getElementById('viz-input-bar-color');
		// jsdom sanitizes the value automatically, but we can override directly.
		Object.defineProperty(input, 'value', { value: 'not-a-color', configurable: true });
		input.dispatchEvent(new Event('input'));

		const normalizer = mocks.normalizeActiveDatasetConfig.mock.calls[0][0];
		const result = normalizer({ bar: { color: '#000000' } });
		expect(result.bar.color).toBe('#abcdef');
	});
});
