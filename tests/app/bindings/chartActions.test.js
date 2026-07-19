// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	addChartToPanel: vi.fn(),
	downloadSvgFromContainer: vi.fn(),
	getActiveDataset: vi.fn(),
	showError: vi.fn(),
	showFeedback: vi.fn(),
	t: vi.fn(key => `tr:${key}`),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
}));

vi.mock('../../../src/services/downloads/svg.js', () => ({
	downloadSvgFromContainer: mocks.downloadSvgFromContainer,
}));

vi.mock('../../../src/features/panel/panelController.js', () => ({
	addChartToPanel: mocks.addChartToPanel,
}));

vi.mock('../../../src/ui/feedback.js', () => ({
	showError: mocks.showError,
	showFeedback: mocks.showFeedback,
}));

vi.mock('../../../src/state/appState.js', () => ({
	getActiveDataset: mocks.getActiveDataset,
}));

import { setupChartActionListeners } from '../../../src/app/bindings/chartActions.js';
import { CHART_CONTAINERS } from '../../../src/charts/workspaceDomIds.js';

function appendChartAction({ type, action = 'add-panel', title = 'Rendered Title', filename = '' }) {
	const containerId = CHART_CONTAINERS[type] || 'unknown-container';
	const block = document.createElement('div');
	block.className = 'chart-block';
	block.innerHTML = `
		<h3 class="chart-title">${title}</h3>
		<button
			data-chart-action="${action}"
			data-chart-container="${containerId}"
			${filename ? `data-chart-filename="${filename}"` : ''}
			type="button"
		></button>
	`;
	document.body.appendChild(block);
	return block.querySelector('button');
}

function fullChartConfig(overrides = {}) {
	return {
		activeTab: 'charts',
		bar: { category: 'species', customTitle: '', ...overrides.bar },
		scatter: { x: 'width', y: 'height', customTitle: '', ...overrides.scatter },
		pie: {
			category: 'family',
			measureMode: 'count',
			valueColumn: '',
			innerRadius: 10,
			outerRadius: 90,
			padAngle: 2,
			labelPosition: 'inside',
			customTitle: '',
			...overrides.pie,
		},
		bubble: {
			category: 'family',
			measureMode: 'count',
			valueColumn: '',
			groupColumn: '',
			topN: 0,
			customTitle: '',
			...overrides.bubble,
		},
		network: { source: 'from', target: 'to', weight: 'count', customTitle: '', ...overrides.network },
		treemap: {
			category: 'family',
			measureMode: 'count',
			valueColumn: '',
			topN: 8,
			customTitle: '',
			...overrides.treemap,
		},
		line: { x: 'date', y: 'visits', curve: 'monotone', customTitle: '', ...overrides.line },
		tin: { x: 'x', y: 'y', z: 'elevation', customTitle: '', ...overrides.tin },
		scatter3d: { x: 'width', y: 'height', z: 'depth', customTitle: '', ...overrides.scatter3d },
	};
}

describe('eventHandlers', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
		mocks.downloadSvgFromContainer.mockReturnValue({ ok: true });
		mocks.addChartToPanel.mockReturnValue({ ok: true });
		mocks.getActiveDataset.mockReturnValue({ chartConfig: { activeTab: 'preview' } });
	});

	it('covers chart download success, default filename, ignored action, and missing targets', () => {
		setupChartActionListeners();

		const downloadButton = appendChartAction({ type: 'bar', action: 'download-svg' });
		downloadButton.click();
		expect(mocks.downloadSvgFromContainer).toHaveBeenLastCalledWith(CHART_CONTAINERS.bar, 'chart');
		expect(mocks.showError).not.toHaveBeenCalledWith('tr:chive-chart-download-error');

		const ignored = appendChartAction({ type: 'bar', action: 'unknown-action' });
		ignored.click();
		expect(mocks.addChartToPanel).not.toHaveBeenCalledWith(CHART_CONTAINERS.bar, expect.anything(), expect.anything());

		document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(() => setupChartActionListeners()).not.toThrow();
	});

	it.each([
		['bar', {}, { summary: 'tr:chive-chart-control-bar-category: species' }],
		['scatter', {}, { summary: 'X: width · Y: height' }],
		['pie', {}, { measureMode: 'count', valueColumn: null, padAngle: 2 }],
		['pie', { pie: { measureMode: 'sum', valueColumn: 'biomass', padAngle: '3' } }, { measureMode: 'sum', valueColumn: 'biomass', padAngle: 3 }],
		['bubble', {}, { measureMode: 'count', valueColumn: null, groupColumn: null, topN: 0 }],
		['bubble', { bubble: { measureMode: 'sum', valueColumn: 'biomass', groupColumn: 'family', topN: 12 } }, { measureMode: 'sum', valueColumn: 'biomass', groupColumn: 'family', topN: 12 }],
		['bubble', { bubble: { measureMode: 'mean', valueColumn: 'biomass', topN: 0 } }, { measureMode: 'mean', valueColumn: 'biomass', topN: 0 }],
		['network', {}, { source: 'from', target: 'to', weight: 'count' }],
		['treemap', {}, { measureMode: 'count', valueColumn: null, topN: 8 }],
		['treemap', { treemap: { measureMode: 'sum', valueColumn: 'biomass' } }, { measureMode: 'sum', valueColumn: 'biomass' }],
		['line', {}, { x: 'date', y: 'visits', curve: 'monotone' }],
		['tin', {}, { x: 'x', y: 'y', z: 'elevation' }],
		['scatter3d', {}, { x: 'width', y: 'height', z: 'depth' }],
	])('builds add-panel snapshot metadata for %s charts', (type, overrides, expected) => {
		setupChartActionListeners();
		mocks.getActiveDataset.mockReturnValue({
			chartConfig: fullChartConfig(overrides),
		});

		const button = appendChartAction({ type, action: 'add-panel', title: `${type} title` });
		button.click();

		const [containerId, title, metadata] = mocks.addChartToPanel.mock.calls.at(-1);
		expect(containerId).toBe(CHART_CONTAINERS[type]);
		expect(title).toBe(`${type} title`);
		expect(metadata).toEqual(expect.objectContaining({ type, ...expected }));
		expect(mocks.showFeedback).toHaveBeenCalledWith('tr:chive-panel-add-success');
	});

	it('uses custom chart titles, generic fallback titles, and empty metadata for unresolved chart types', () => {
		setupChartActionListeners();
		mocks.getActiveDataset.mockReturnValue({
			chartConfig: fullChartConfig({ bar: { customTitle: 'Custom Bar' } }),
		});

		appendChartAction({ type: 'bar', action: 'add-panel', title: 'Fallback Bar' }).click();
		expect(mocks.addChartToPanel.mock.calls.at(-1)[1]).toBe('Custom Bar');

		const unknownButton = appendChartAction({ type: 'unknown', action: 'add-panel', title: '' });
		unknownButton.closest('.chart-block').querySelector('.chart-title').remove();
		unknownButton.click();
		expect(mocks.addChartToPanel.mock.calls.at(-1)).toEqual([
			'unknown-container',
			'tr:chive-card-charts',
			{},
		]);

		mocks.getActiveDataset.mockReturnValue(null);
		appendChartAction({ type: 'bar', action: 'add-panel', title: 'No Dataset' }).click();
		expect(mocks.addChartToPanel.mock.calls.at(-1)[2]).toEqual({});
	});
});
