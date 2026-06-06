// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn((key, ...args) => (args.length ? `${key}:${args.join(',')}` : key)),
	getLocale: vi.fn(() => 'en'),
	translateType: vi.fn(type => type),
	mergeChartConfigWithDefaults: vi.fn(config => config),
	renderCharts: vi.fn(),
	getNumericColumns: vi.fn(columns => columns.filter(column => column.type === 'number')),
	updateTabs: vi.fn(),
	renderTablePreview: vi.fn(),
	renderStats: vi.fn(),
	renderCategoricalStats: vi.fn(),
	renderFileListDOM: vi.fn(),
	renderColumnControlsDOM: vi.fn(),
	openJoinBuilderDialog: vi.fn(),
	openPresetDatasetsDialog: vi.fn(),
	openGlobalFilterDialog: vi.fn(),
}));

vi.mock('../../src/services/i18nService.js', () => ({
	t: mocks.t,
	getLocale: mocks.getLocale,
	translateType: mocks.translateType,
}));

vi.mock('../../src/config/chartDefaults.js', () => ({
	mergeChartConfigWithDefaults: mocks.mergeChartConfigWithDefaults,
}));

vi.mock('../../src/features/chartFeatures.js', () => ({
	renderCharts: mocks.renderCharts,
}));

vi.mock('../../src/utils/columnHelpers.js', () => ({
	getNumericColumns: mocks.getNumericColumns,
}));

vi.mock('../../src/components/results/tabsView.js', () => ({
	updateTabs: mocks.updateTabs,
}));

vi.mock('../../src/components/results/tablePreviewView.js', () => ({
	renderTablePreview: mocks.renderTablePreview,
}));

vi.mock('../../src/components/results/statsView.js', () => ({
	renderStats: mocks.renderStats,
	renderCategoricalStats: mocks.renderCategoricalStats,
}));

vi.mock('../../src/components/results/fileListView.js', () => ({
	renderFileListDOM: mocks.renderFileListDOM,
}));

vi.mock('../../src/components/results/columnControlsView.js', () => ({
	renderColumnControlsDOM: mocks.renderColumnControlsDOM,
}));

vi.mock('../../src/components/results/joinBuilderView.js', () => ({
	openJoinBuilderDialog: mocks.openJoinBuilderDialog,
}));

vi.mock('../../src/components/results/presetDatasetsView.js', () => ({
	openPresetDatasetsDialog: mocks.openPresetDatasetsDialog,
}));

vi.mock('../../src/components/results/globalFilterDialog.js', () => ({
	openGlobalFilterDialog: mocks.openGlobalFilterDialog,
}));

import { renderDataInterface } from '../../src/components/resultsView.js';

function setupDom() {
	document.body.innerHTML = `
		<div id="columns-panel"></div>
		<div id="result-tabs"></div>
		<div id="empty-state"></div>
		<div id="data-state"></div>
		<div id="column-actions-bar"></div>
		<div id="column-list-content"></div>
		<select id="select-preview-rows"><option value="10">10</option></select>
		<div id="badge-rows"></div>
		<button id="btn-advance" disabled></button>
		<div id="upload-zone"></div>
		<span class="upload-icon"></span>
		<p class="upload-text-main"></p>
		<p class="upload-text-sub"></p>
		<div id="file-summary-text"></div>
	`;
}

describe('renderDataInterface global filter behavior', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.mergeChartConfigWithDefaults.mockImplementation(config => config);
		setupDom();
	});

	it('uses filtered rows for preview/stats while leaving chart filtering to renderCharts', () => {
		const rows = [{ region: 'A', value: 1 }, { region: 'B', value: 2 }];
		const columns = [{ name: 'region', type: 'text' }, { name: 'value', type: 'number' }];
		const config = {
			activeTab: 'preview',
			globalFilter: {
				rules: [{ column: 'region', mode: 'categorical', include: ['v:A'], exclude: [] }],
			},
		};

		renderDataInterface(rows, columns, 'data.csv', '2 KB', 10, null, null, null, config, vi.fn());

		const filtered = [{ region: 'A', value: 1 }];
		expect(mocks.renderTablePreview).toHaveBeenCalledWith(filtered, columns, 10);
		expect(mocks.renderStats).toHaveBeenCalledWith(filtered, columns);
		expect(mocks.renderCategoricalStats).toHaveBeenCalledWith(filtered, columns);
		expect(mocks.renderCharts.mock.calls[0][1]).toBe(rows);
		const triggerState = mocks.updateTabs.mock.calls[0][3].triggerState;
		expect(triggerState).toEqual(expect.objectContaining({
			hasDataset: true,
			filteredCount: 1,
			totalCount: 2,
		}));
		expect(triggerState.globalFilter.rules[0]).toEqual(expect.objectContaining({
			column: 'region',
			include: ['v:A'],
		}));
		expect(document.getElementById('badge-rows').textContent).toBe('chive-badge-preview:1,1,2,2');
	});
});
