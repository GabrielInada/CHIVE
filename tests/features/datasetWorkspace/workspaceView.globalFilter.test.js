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

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
	getLocale: mocks.getLocale,
	translateType: mocks.translateType,
}));

vi.mock('../../../src/config/chartDefaults.js', () => ({
	mergeChartConfigWithDefaults: mocks.mergeChartConfigWithDefaults,
}));

vi.mock('../../../src/features/datasetWorkspace/views/chartsView.js', () => ({
	renderCharts: mocks.renderCharts,
}));

vi.mock('../../../src/utils/columnHelpers.js', () => ({
	getNumericColumns: mocks.getNumericColumns,
}));

vi.mock('../../../src/features/datasetWorkspace/views/tabsView.js', () => ({
	updateTabs: mocks.updateTabs,
}));

vi.mock('../../../src/features/datasetWorkspace/views/tablePreviewView.js', () => ({
	renderTablePreview: mocks.renderTablePreview,
}));

vi.mock('../../../src/features/datasetWorkspace/views/statsView.js', () => ({
	renderStats: mocks.renderStats,
	renderCategoricalStats: mocks.renderCategoricalStats,
}));

vi.mock('../../../src/features/datasetWorkspace/views/fileListView.js', () => ({
	renderFileListDOM: mocks.renderFileListDOM,
}));

vi.mock('../../../src/features/datasetWorkspace/views/columnControlsView.js', () => ({
	renderColumnControlsDOM: mocks.renderColumnControlsDOM,
}));

vi.mock('../../../src/features/datasetWorkspace/dialogs/joinBuilderView.js', () => ({
	openJoinBuilderDialog: mocks.openJoinBuilderDialog,
}));

vi.mock('../../../src/features/datasetWorkspace/dialogs/presetDatasetsView.js', () => ({
	openPresetDatasetsDialog: mocks.openPresetDatasetsDialog,
}));

vi.mock('../../../src/features/datasetWorkspace/dialogs/globalFilterDialog.js', () => ({
	openGlobalFilterDialog: mocks.openGlobalFilterDialog,
}));

import { renderDatasetWorkspace, renderEmptyState, renderFileList } from '../../../src/features/datasetWorkspace/workspaceView.js';
import { CHART_CONTAINERS } from '../../../src/charts/workspaceDomIds.js';

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

function setupFileListDom() {
	document.body.innerHTML = `
		<section id="file-info">
			<div id="file-summary-text"></div>
			<div id="file-list-content"></div>
		</section>
	`;
}

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
		<div id="dev-warning"></div>
		<div id="upload-zone" class="loaded"></div>
		<span class="upload-icon"></span>
		<p class="upload-text-main"></p>
		<p class="upload-text-sub"></p>
	`;
}

describe('renderDatasetWorkspace global filter behavior', () => {
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

		renderDatasetWorkspace(rows, columns, 'data.csv', '2 KB', 10, null, null, null, config, vi.fn());

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

	it('wires preview-row changes and ignores invalid row counts', () => {
		const onPreviewRowsChange = vi.fn();
		const rows = [{ region: 'A', value: 1 }];
		const columns = [{ name: 'region', type: 'text' }, { name: 'value', type: 'number' }];
		const select = document.getElementById('select-preview-rows');
		select.appendChild(new Option('25', '25'));
		select.appendChild(new Option('0', '0'));

		renderDatasetWorkspace(rows, columns, 'data.csv', '2 KB', 10, onPreviewRowsChange, null, null, {
			activeTab: 'preview',
			globalFilter: { rules: [] },
		}, vi.fn());

		select.value = '25';
		select.dispatchEvent(new Event('change'));
		select.value = '0';
		select.dispatchEvent(new Event('change'));

		expect(onPreviewRowsChange).toHaveBeenCalledTimes(1);
		expect(onPreviewRowsChange).toHaveBeenCalledWith(25);
	});

	it('forwards chart tooltip global-filter callbacks to chart config changes', () => {
		const onChartConfigChange = vi.fn();
		const rows = [{ region: 'A', value: 1 }, { region: 'B', value: 2 }];
		const columns = [{ name: 'region', type: 'text' }, { name: 'value', type: 'number' }];
		const config = {
			activeTab: 'charts',
			globalFilter: {
				rules: [{ column: 'region', mode: 'categorical', include: ['v:A'], exclude: ['v:B'] }],
			},
		};

		renderDatasetWorkspace(rows, columns, 'data.csv', '2 KB', 10, null, null, null, config, onChartConfigChange);

		const callbacks = mocks.renderCharts.mock.calls[0][4];
		callbacks.onAddToGlobalFilter('region', 'v:C');
		callbacks.onFocusGlobalFilter('region', 'v:C');
		callbacks.onExcludeGlobalFilter('region', 'v:C');
		callbacks.onRemoveFromGlobalFilter('region', 'v:A');
		callbacks.onBringBackGlobalFilter('region', 'v:B');
		callbacks.onAddToGlobalFilter('missing', 'v:x');
		callbacks.onAddToGlobalFilter('region', 42);

		expect(onChartConfigChange).toHaveBeenCalledTimes(5);
		expect(onChartConfigChange.mock.calls[0][0].globalFilter.rules[0].include).toContain('v:C');
		expect(onChartConfigChange.mock.calls[1][0].globalFilter.rules[0]).toEqual(expect.objectContaining({
			column: 'region',
			include: ['v:C'],
		}));
		expect(onChartConfigChange.mock.calls[2][0].globalFilter.rules[0].exclude).toContain('v:C');
		expect(onChartConfigChange.mock.calls[3][0].globalFilter.rules[0].include).not.toContain('v:A');
		expect(onChartConfigChange.mock.calls[4][0].globalFilter.rules[0].exclude).not.toContain('v:B');
		expect(callbacks.getTokenFilterState('region', 'v:A')).toBe('included');
		expect(callbacks.isShowOnlyThisRedundant('region', 'v:A')).toBe(false);
	});

	it('opens the global-filter dialog and applies returned filters', async () => {
		const onChartConfigChange = vi.fn();
		const rows = [{ region: 'A', value: 1 }];
		const columns = [{ name: 'region', type: 'text' }, { name: 'value', type: 'number' }];
		const nextFilter = { combine: 'AND', rules: [{ column: 'region', mode: 'categorical', include: ['v:A'] }] };
		mocks.openGlobalFilterDialog.mockResolvedValueOnce({ action: 'apply', filter: nextFilter });

		renderDatasetWorkspace(rows, columns, 'data.csv', '2 KB', 10, null, null, null, {
			activeTab: 'preview',
			globalFilter: { rules: [] },
		}, onChartConfigChange);

		await mocks.updateTabs.mock.calls[0][3].onGlobalFilterOpen();

		expect(mocks.openGlobalFilterDialog).toHaveBeenCalledWith(expect.objectContaining({
			rows,
			allColumns: ['region', 'value'],
			numericColumns: ['value'],
			initialFilter: expect.objectContaining({ rules: [] }),
			translate: mocks.t,
		}));
		expect(onChartConfigChange).toHaveBeenCalledWith({ globalFilter: nextFilter });
	});

	it.each([
		{
			label: 'a stale rule referencing a missing column',
			globalFilter: { rules: [{ column: 'missing', mode: 'categorical', include: ['v:x'], exclude: [] }] },
			expectedRules: [],
			expectedPreviewRows: 2,
		},
		{
			label: 'the legacy single-filter shape',
			globalFilter: { column: 'region', mode: 'categorical', include: ['v:A'] },
			expectedRules: [expect.objectContaining({ column: 'region', include: ['v:A'] })],
			expectedPreviewRows: 1,
		},
	])('derives $label locally without writing config back during render', ({ globalFilter, expectedRules, expectedPreviewRows }) => {
		const onChartConfigChange = vi.fn();
		const rows = [{ region: 'A', value: 1 }, { region: 'B', value: 2 }];
		const columns = [{ name: 'region', type: 'text' }, { name: 'value', type: 'number' }];

		renderDatasetWorkspace(rows, columns, 'data.csv', '2 KB', 10, null, null, null, {
			activeTab: 'preview',
			globalFilter,
		}, onChartConfigChange);

		// Checked before any dialog/token callback runs: those still write config
		// legitimately, but the render itself must not.
		expect(onChartConfigChange).not.toHaveBeenCalled();
		const triggerState = mocks.updateTabs.mock.calls[0][3].triggerState;
		expect(triggerState.globalFilter.rules).toEqual(expectedRules);
		expect(mocks.renderTablePreview.mock.calls[0][0]).toHaveLength(expectedPreviewRows);
	});

	it('reports numeric, text, and mixed column-selection filters to the column controls', () => {
		const rows = [{ region: 'A', category: 'Retail', value: 1 }];
		const columns = [
			{ name: 'region', type: 'text' },
			{ name: 'category', type: 'text' },
			{ name: 'value', type: 'number' },
			{ name: 'score', type: 'number' },
		];

		renderDatasetWorkspace(rows, columns, 'data.csv', '2 KB', 10, null, ['value', 'score'], null, {
			activeTab: 'preview',
			globalFilter: { rules: [] },
		}, vi.fn());
		expect(mocks.renderColumnControlsDOM.mock.calls.at(-1)[0].activeFilter).toBe('numeric');

		renderDatasetWorkspace(rows, columns, 'data.csv', '2 KB', 10, null, ['region', 'category'], null, {
			activeTab: 'preview',
			globalFilter: { rules: [] },
		}, vi.fn());
		expect(mocks.renderColumnControlsDOM.mock.calls.at(-1)[0].activeFilter).toBe('text');

		renderDatasetWorkspace(rows, columns, 'data.csv', '2 KB', 10, null, ['region', 'value'], null, {
			activeTab: 'preview',
			globalFilter: { rules: [] },
		}, vi.fn());
		expect(mocks.renderColumnControlsDOM.mock.calls.at(-1)[0].activeFilter).toBeNull();
	});

	it('handles missing preview selector, invalid preview row defaults, and no change callback', () => {
		document.getElementById('select-preview-rows').remove();
		const rows = [{ region: 'A', value: 1 }];
		const columns = [{ name: 'region', type: 'text' }, { name: 'value', type: 'number' }];

		expect(() => renderDatasetWorkspace(rows, columns, 'data.csv', '2 KB', -5, null, null, null, {
			activeTab: 'preview',
			globalFilter: { rules: [] },
		}, vi.fn())).not.toThrow();

		expect(mocks.renderTablePreview).toHaveBeenCalledWith(rows, columns, 10);
	});

	it('ignores invalid global-filter callback payloads for every chart action', () => {
		const onChartConfigChange = vi.fn();
		const rows = [{ region: 'A', value: 1 }];
		const columns = [{ name: 'region', type: 'text' }, { name: 'value', type: 'number' }];

		renderDatasetWorkspace(rows, columns, 'data.csv', '2 KB', 10, null, null, null, {
			activeTab: 'charts',
			globalFilter: { rules: [] },
		}, onChartConfigChange);

		const callbacks = mocks.renderCharts.mock.calls[0][4];
		callbacks.onAddToGlobalFilter('missing', 'v:A');
		callbacks.onFocusGlobalFilter('region', 42);
		callbacks.onExcludeGlobalFilter(42, 'v:A');
		callbacks.onRemoveFromGlobalFilter('missing', 'v:A');
		callbacks.onBringBackGlobalFilter('region', 42);

		expect(onChartConfigChange).not.toHaveBeenCalled();
	});

	it('handles global-filter dialog clear, cancel, and disabled callback paths', async () => {
		const onChartConfigChange = vi.fn();
		const rows = [{ region: 'A', value: 1 }];
		const columns = [{ name: 'region', type: 'text' }, { name: 'value', type: 'number' }];
		const cleared = { combine: 'AND', rules: [] };

		mocks.openGlobalFilterDialog.mockResolvedValueOnce({ action: 'clear', filter: cleared });
		renderDatasetWorkspace(rows, columns, 'data.csv', '2 KB', 10, null, null, null, {
			activeTab: 'preview',
			globalFilter: { rules: [] },
		}, onChartConfigChange);
		await mocks.updateTabs.mock.calls.at(-1)[3].onGlobalFilterOpen();
		expect(onChartConfigChange).toHaveBeenCalledWith({ globalFilter: cleared });

		mocks.openGlobalFilterDialog.mockResolvedValueOnce(null);
		renderDatasetWorkspace(rows, columns, 'data.csv', '2 KB', 10, null, null, null, {
			activeTab: 'preview',
			globalFilter: { rules: [] },
		}, onChartConfigChange);
		await mocks.updateTabs.mock.calls.at(-1)[3].onGlobalFilterOpen();
		expect(onChartConfigChange).toHaveBeenCalledTimes(1);

		renderDatasetWorkspace(rows, columns, 'data.csv', '2 KB', 10, null, null, null, {
			activeTab: 'preview',
			globalFilter: { rules: [] },
		}, null);
		await mocks.updateTabs.mock.calls.at(-1)[3].onGlobalFilterOpen();
		expect(mocks.openGlobalFilterDialog).toHaveBeenCalledTimes(2);
	});
});

describe('renderFileList orchestration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.renderFileListDOM.mockImplementation(({ list, datasets, filter, visibleLimit }) => {
			list.replaceChildren();
			const count = filter ? 1 : datasets.length;
			return {
				total: datasets.length,
				filtered: count,
				rendered: Math.min(count, visibleLimit),
				hasMore: count > visibleLimit,
			};
		});
		mocks.openJoinBuilderDialog.mockResolvedValue({ leftIndex: 0, rightIndex: 1 });
		mocks.openPresetDatasetsDialog.mockResolvedValue({ id: 'iris' });
		setupFileListDom();
	});

	it('renders file tools, paginates, searches, and forwards join/preset choices', async () => {
		const datasets = Array.from({ length: 20 }, (_, index) => ({
			name: `Data ${index}.csv`,
			rows: [{ id: index }],
			columns: [{ name: 'id' }],
			sizeLabel: `${index} KB`,
		}));
		const onSelect = vi.fn();
		const onRemove = vi.fn();
		const onCreateJoin = vi.fn();
		const onLoadPreset = vi.fn();

		renderFileList(datasets, 1, onSelect, onRemove, onCreateJoin, onLoadPreset);

		expect(document.getElementById('file-summary-text').textContent).toBe('chive-files-loaded:20');
		expect(document.getElementById('file-selected-meta').textContent).toContain('Data 1.csv');
		expect(document.getElementById('btn-join-files').disabled).toBe(false);
		expect(document.getElementById('files-pagination').textContent).toContain('chive-files-show-more');

		document.querySelector('.files-pagination-btn').click();
		expect(mocks.renderFileListDOM.mock.calls.at(-1)[0].visibleLimit).toBe(30);

		const search = document.getElementById('files-filter-input');
		search.value = 'iris';
		search.dispatchEvent(new Event('input'));
		expect(mocks.renderFileListDOM.mock.calls.at(-1)[0]).toEqual(expect.objectContaining({
			filter: 'iris',
			visibleLimit: 15,
		}));

		document.getElementById('btn-join-files').click();
		await Promise.resolve();
		expect(onCreateJoin).toHaveBeenCalledWith({ leftIndex: 0, rightIndex: 1 });

		document.getElementById('btn-preset-datasets').click();
		await Promise.resolve();
		expect(onLoadPreset).toHaveBeenCalledWith({ id: 'iris' });
	});

	it('disables the join action when there are fewer than two datasets', () => {
		renderFileList([
			{ name: 'Only.csv', rows: [], columns: [], sizeLabel: '0 KB' },
		], 0, vi.fn(), vi.fn(), vi.fn(), vi.fn());

		expect(document.getElementById('btn-join-files').disabled).toBe(true);
	});

	it('reuses and moves existing header/tool nodes and handles invalid active index', () => {
		document.body.innerHTML = `
			<div id="file-selected-meta"></div>
			<div id="files-tools"></div>
			<section id="file-info">
				<div id="files-top-fixed"></div>
				<div id="file-summary-text"></div>
				<div id="file-list-content"></div>
			</section>
		`;
		mocks.renderFileListDOM.mockReturnValue({ total: 1, filtered: 1, rendered: 1, hasMore: false });

		renderFileList([
			{ name: 'Only.csv', rows: [], columns: [], sizeLabel: '0 KB' },
		], 10, vi.fn(), vi.fn());

		const sticky = document.getElementById('files-top-fixed');
		expect(sticky.parentElement.id).toBe('file-info');
		expect(document.getElementById('file-selected-meta').parentElement).toBe(sticky);
		expect(document.getElementById('files-tools').parentElement).toBe(sticky);
		expect(document.getElementById('file-selected-meta').style.display).toBe('none');
		expect(document.getElementById('file-selected-meta').getAttribute('title')).toBeNull();
	});

	it('renders show-less pagination and resets visible count when clicked', () => {
		mocks.renderFileListDOM
			.mockReturnValueOnce({ total: 20, filtered: 20, rendered: 20, hasMore: false })
			.mockReturnValueOnce({ total: 20, filtered: 20, rendered: 15, hasMore: true });

		renderFileList(Array.from({ length: 20 }, (_, index) => ({
			name: `Data ${index}.csv`,
			rows: [],
			columns: [],
			sizeLabel: '1 KB',
		})), -1, vi.fn(), vi.fn());

		expect(document.getElementById('files-pagination').textContent).toContain('chive-files-show-less');
		document.querySelector('.files-pagination-btn').click();
		expect(mocks.renderFileListDOM.mock.calls.at(-1)[0].visibleLimit).toBe(15);
	});

	it('ignores canceled join and preset dialogs and tolerates absent optional callbacks', async () => {
		mocks.openJoinBuilderDialog.mockResolvedValueOnce(null);
		mocks.openPresetDatasetsDialog.mockResolvedValueOnce(null);
		mocks.renderFileListDOM.mockReturnValue({ total: 2, filtered: 2, rendered: 2, hasMore: false });
		const onCreateJoin = vi.fn();
		const onLoadPreset = vi.fn();
		const datasets = [
			{ name: 'A.csv', rows: [], columns: [], sizeLabel: '1 KB' },
			{ name: 'B.csv', rows: [], columns: [], sizeLabel: '1 KB' },
		];

		renderFileList(datasets, 0, vi.fn(), vi.fn(), onCreateJoin, onLoadPreset);
		document.getElementById('btn-join-files').click();
		document.getElementById('btn-preset-datasets').click();
		await Promise.resolve();

		expect(onCreateJoin).not.toHaveBeenCalled();
		expect(onLoadPreset).not.toHaveBeenCalled();

		mocks.openJoinBuilderDialog.mockResolvedValueOnce({ leftIndex: 0, rightIndex: 1 });
		mocks.openPresetDatasetsDialog.mockResolvedValueOnce({ id: 'sample' });
		renderFileList(datasets, 0, vi.fn(), vi.fn());
		document.getElementById('btn-join-files').click();
		document.getElementById('btn-preset-datasets').click();
		await Promise.resolve();
	});
});

describe('renderEmptyState', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setupEmptyStateDom();
	});

	it('clears active result content and restores empty upload state', () => {
		renderEmptyState();

		expect(document.getElementById('columns-panel').style.display).toBe('none');
		expect(document.getElementById('empty-state').style.display).toBe('flex');
		expect(document.getElementById('data-state').style.display).toBe('none');
		expect(document.getElementById('table-container').children.length).toBe(0);
		expect(document.getElementById('container-stats').children.length).toBe(0);
		expect(document.getElementById('card-cat-stats').style.display).toBe('none');
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
