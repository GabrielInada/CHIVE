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
	renderColumnControlsDOM: vi.fn(),
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

vi.mock('../../../src/domain/datasets/columns.js', () => ({
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

vi.mock('../../../src/features/datasetWorkspace/views/columnControlsView.js', () => ({
	renderColumnControlsDOM: mocks.renderColumnControlsDOM,
}));

vi.mock('../../../src/features/datasetWorkspace/dialogs/globalFilterDialog.js', () => ({
	openGlobalFilterDialog: mocks.openGlobalFilterDialog,
}));

import { renderDatasetWorkspace } from '../../../src/features/datasetWorkspace/workspaceView.js';

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
