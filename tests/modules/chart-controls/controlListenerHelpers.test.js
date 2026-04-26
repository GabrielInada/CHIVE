// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	updateActiveDatasetChartConfig: vi.fn(),
}));

vi.mock('../../../src/modules/stateSync.js', () => ({
	updateActiveDatasetChartConfig: mocks.updateActiveDatasetChartConfig,
}));

import { setupExpandListener, setupColorInputListener } from '../../../src/modules/chart-controls/controlListenerHelpers.js';
import { setLiveRenderCallback } from '../../../src/modules/chart-controls/livePreview.js';

function createDataset() {
	return {
		configGraficos: {
			bar: {
				expanded: false,
			},
		},
	};
}

describe('controlListenerHelpers setupExpandListener', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = `
			<button id="viz-expand-bar" aria-expanded="false" type="button">▸</button>
			<div id="viz-body-bar" hidden></div>
		`;
	});

	it('opens the parameters body immediately and persists expanded state', () => {
		const dataset = createDataset();
		setupExpandListener('viz-expand-bar', dataset, 'bar');

		const expandButton = document.getElementById('viz-expand-bar');
		const body = document.getElementById('viz-body-bar');
		expandButton.click();

		expect(expandButton.getAttribute('aria-expanded')).toBe('true');
		expect(expandButton.textContent).toBe('▾');
		expect(body.hidden).toBe(false);
		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledWith({
			bar: {
				expanded: true,
			},
		});
	});
});

describe('controlListenerHelpers setupColorInputListener', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setLiveRenderCallback(null);
		document.body.innerHTML = '<input id="viz-input-bar-color" type="color" value="#000000">';
	});

	function makeDataset(initialColor) {
		return {
			configGraficos: {
				bar: {
					color: initialColor,
				},
			},
		};
	}

	it('mutates config in-place and calls live-render on input event without committing state', () => {
		const dataset = makeDataset('#000000');
		const liveRender = vi.fn();
		setLiveRenderCallback(liveRender);
		setupColorInputListener('viz-input-bar-color', 'color', '#abcdef', dataset, 'bar');

		const input = document.getElementById('viz-input-bar-color');
		input.value = '#ff0000';
		input.dispatchEvent(new Event('input'));

		expect(dataset.configGraficos.bar.color.toLowerCase()).toBe('#ff0000');
		expect(liveRender).toHaveBeenCalledTimes(1);
		expect(mocks.updateActiveDatasetChartConfig).not.toHaveBeenCalled();
	});

	it('commits via canonical state path on change event', () => {
		const dataset = makeDataset('#000000');
		setupColorInputListener('viz-input-bar-color', 'color', '#abcdef', dataset, 'bar');

		const input = document.getElementById('viz-input-bar-color');
		input.value = '#00ff00';
		input.dispatchEvent(new Event('change'));

		expect(mocks.updateActiveDatasetChartConfig).toHaveBeenCalledTimes(1);
		const callArg = mocks.updateActiveDatasetChartConfig.mock.calls[0][0];
		expect(callArg.bar.color.toLowerCase()).toBe('#00ff00');
	});

	it('falls back to default color when the input value is invalid', () => {
		const dataset = makeDataset('#000000');
		setLiveRenderCallback(vi.fn());
		setupColorInputListener('viz-input-bar-color', 'color', '#abcdef', dataset, 'bar');

		const input = document.getElementById('viz-input-bar-color');
		// jsdom forces a sanitized value, but we can override directly to simulate a bad value
		Object.defineProperty(input, 'value', { value: 'not-a-color', configurable: true });
		input.dispatchEvent(new Event('input'));

		expect(dataset.configGraficos.bar.color).toBe('#abcdef');
	});
});
