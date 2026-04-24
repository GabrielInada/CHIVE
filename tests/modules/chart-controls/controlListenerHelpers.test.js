// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	updateActiveDatasetChartConfig: vi.fn(),
}));

vi.mock('../../../src/modules/stateSync.js', () => ({
	updateActiveDatasetChartConfig: mocks.updateActiveDatasetChartConfig,
}));

import { setupExpandListener } from '../../../src/modules/chart-controls/controlListenerHelpers.js';

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
