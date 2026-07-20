// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn((key, ...args) => (args.length ? `${key}:${args.join(',')}` : key)),
	updateTabs: vi.fn(),
}));

vi.mock('../../../../src/services/i18nService.js', () => ({
	t: mocks.t,
}));

vi.mock('../../../../src/features/datasetWorkspace/views/tabsView.js', () => ({
	updateTabs: mocks.updateTabs,
}));

import { renderEmptyState } from '../../../../src/features/datasetWorkspace/views/emptyWorkspaceView.js';
import { CHART_CONTAINERS } from '../../../../src/charts/workspaceDomIds.js';

function setupEmptyStateDom() {
	document.body.innerHTML = `
		<section id="file-info"></section>
		<section id="columns-panel"></section>
		<section id="empty-state"></section>
		<section id="data-state"></section>
		<nav id="result-tabs"></nav>
		<div id="table-container"><span>old table</span></div>
		<div id="container-stats"><span>old stats</span></div>
		<div id="container-cat-stats"><span>old cats</span></div>
		<section id="card-cat-stats"></section>
		<div id="chart-bar-container"><svg></svg></div>
		<div id="chart-scatter-container"><svg></svg></div>
		<div id="chart-network-container"><svg></svg></div>
		<div id="chart-pie-container"><svg></svg></div>
		<div id="chart-bubble-container"><svg></svg></div>
		<div id="chart-treemap-container"><svg></svg></div>
		<div id="chart-line-container"><svg></svg></div>
		<div id="chart-tin-container"><svg></svg></div>
		<div id="chart-scatter3d-container"><canvas></canvas></div>
		<span id="badge-charts">7</span>
		<button id="btn-advance"></button>
		<div id="upload-zone" class="loaded"></div>
		<span class="upload-icon"></span>
		<p class="upload-text-main"></p>
		<p class="upload-text-sub"></p>
	`;
}

describe('renderEmptyState', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setupEmptyStateDom();
	});

	it('clears active result content and restores empty upload state', () => {
		renderEmptyState();

		expect(document.getElementById('columns-panel').hidden).toBe(true);
		expect(document.getElementById('empty-state').hidden).toBe(false);
		expect(document.getElementById('data-state').hidden).toBe(true);
		expect(document.getElementById('table-container').children.length).toBe(0);
		expect(document.getElementById('container-stats').children.length).toBe(0);
		expect(document.getElementById('card-cat-stats').hidden).toBe(true);
		for (const containerId of Object.values(CHART_CONTAINERS)) {
			expect(document.getElementById(containerId).children.length).toBe(0);
		}
		expect(document.getElementById('badge-charts').textContent).toBe('0');
		expect(document.getElementById('btn-advance').disabled).toBe(true);
		expect(document.getElementById('upload-zone').classList.contains('loaded')).toBe(false);
		expect(document.querySelector('.upload-text-main').textContent).toBe('chive-upload-main');
		expect(mocks.updateTabs).toHaveBeenCalledWith('preview', null, null, {
			triggerState: {
				hasDataset: false,
				globalFilter: null,
				filteredCount: 0,
				totalCount: 0,
			},
		});
	});

	it('tolerates a sparse DOM with optional result elements missing', () => {
		document.body.innerHTML = '<section id="result-tabs"></section>';

		expect(() => renderEmptyState()).not.toThrow();
		expect(mocks.updateTabs).toHaveBeenCalledWith('preview', null, null, expect.objectContaining({
			triggerState: expect.objectContaining({ hasDataset: false }),
		}));
	});
});
