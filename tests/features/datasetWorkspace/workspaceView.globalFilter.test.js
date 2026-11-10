// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn((key, ...args) => (args.length ? `${key}:${args.join(',')}` : key)),
	getLocale: vi.fn(() => 'en'),
	translateType: vi.fn(type => type),
	renderCharts: vi.fn(),
	updateTabs: vi.fn(),
	renderTablePreview: vi.fn(),
	renderNumericStats: vi.fn(),
	renderCategoricalStats: vi.fn(),
	renderColumnControlsDOM: vi.fn(),
	openGlobalFilterDialog: vi.fn(),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
	getLocale: mocks.getLocale,
	translateType: mocks.translateType,
}));

vi.mock('../../../src/features/datasetWorkspace/views/chartsView.js', () => ({
	renderCharts: mocks.renderCharts,
}));

vi.mock('../../../src/features/datasetWorkspace/views/tabsView.js', () => ({
	updateTabs: mocks.updateTabs,
}));

vi.mock('../../../src/features/datasetWorkspace/views/tablePreviewView.js', () => ({
	renderTablePreview: mocks.renderTablePreview,
}));

vi.mock('../../../src/features/datasetWorkspace/views/statsView.js', () => ({
	renderNumericStats: mocks.renderNumericStats,
	renderCategoricalStats: mocks.renderCategoricalStats,
}));

vi.mock('../../../src/features/datasetWorkspace/views/columnControlsView.js', () => ({
	renderColumnControlsDOM: mocks.renderColumnControlsDOM,
}));

vi.mock('../../../src/features/datasetWorkspace/dialogs/globalFilterDialog.js', () => ({
	openGlobalFilterDialog: mocks.openGlobalFilterDialog,
}));

import { renderDatasetWorkspace } from '../../../src/features/datasetWorkspace/workspaceView.js';
import { deriveShownDataset } from '../../../src/domain/datasets/shownDataset.js';

const ROWS = [{ region: 'A', value: 1 }, { region: 'B', value: 2 }];
const COLUMNS = [{ name: 'region', type: 'text' }, { name: 'value', type: 'number' }];

function makeDataset({ rows = ROWS, columns = COLUMNS, selectedColumns, chartConfig } = {}) {
	return {
		name: 'data.csv',
		sizeLabel: '2 KB',
		rows,
		columns,
		selectedColumns: selectedColumns ?? columns.map(column => column.name),
		chartConfig: { activeTab: 'preview', globalFilter: { rules: [] }, ...chartConfig },
	};
}

function render(dataset, options = {}) {
	const shown = deriveShownDataset(dataset);
	renderDatasetWorkspace(shown, { previewRows: 10, onDatasetConfigChange: vi.fn(), ...options });
	return shown;
}

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
		setupDom();
	});

	it('gives the preview, the stats and the charts the same filtered rows', () => {
		const shown = render(makeDataset({
			chartConfig: {
				globalFilter: { rules: [{ column: 'region', mode: 'categorical', include: ['v:A'], exclude: [] }] },
			},
		}));

		const filtered = [{ region: 'A', value: 1 }];
		expect(shown.rows).toEqual(filtered);
		expect(mocks.renderTablePreview).toHaveBeenCalledWith(shown.rows, COLUMNS, 10);
		expect(mocks.renderNumericStats).toHaveBeenCalledWith(shown.rows, COLUMNS);
		expect(mocks.renderCategoricalStats).toHaveBeenCalledWith(shown.rows, COLUMNS);
		const triggerState = mocks.updateTabs.mock.calls[0][2].triggerState;
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

	it('hands the charts the shown dataset and the config-change callback', () => {
		const onDatasetConfigChange = vi.fn();
		const shown = render(makeDataset({ chartConfig: { activeTab: 'charts' } }), { onDatasetConfigChange });

		expect(mocks.renderCharts).toHaveBeenCalledWith(shown, onDatasetConfigChange);
	});

	it('keeps applying a rule while the column list hides its column', () => {
		const shown = render(makeDataset({
			selectedColumns: ['value'],
			chartConfig: {
				activeTab: 'charts',
				globalFilter: { rules: [{ column: 'region', mode: 'categorical', include: ['v:A'], exclude: [] }] },
			},
		}));

		expect(mocks.renderTablePreview).toHaveBeenCalledWith([{ region: 'A', value: 1 }], [{ name: 'value', type: 'number' }], 10);
		expect(mocks.renderCharts.mock.calls[0][0]).toBe(shown);
	});

	it('wires preview-row changes and ignores invalid row counts', () => {
		const onPreviewRowsChange = vi.fn();
		const select = document.getElementById('select-preview-rows');
		select.appendChild(new Option('25', '25'));
		select.appendChild(new Option('0', '0'));

		render(makeDataset(), { onPreviewRowsChange });

		select.value = '25';
		select.dispatchEvent(new Event('change'));
		select.value = '0';
		select.dispatchEvent(new Event('change'));

		expect(onPreviewRowsChange).toHaveBeenCalledTimes(1);
		expect(onPreviewRowsChange).toHaveBeenCalledWith(25);
	});

	it('opens the global-filter dialog and applies returned filters', async () => {
		const onDatasetConfigChange = vi.fn();
		const dataset = makeDataset({ rows: [{ region: 'A', value: 1 }] });
		const nextFilter = { combine: 'AND', rules: [{ column: 'region', mode: 'categorical', include: ['v:A'] }] };
		mocks.openGlobalFilterDialog.mockResolvedValueOnce({ action: 'apply', filter: nextFilter });

		render(dataset, { onDatasetConfigChange });

		await mocks.updateTabs.mock.calls[0][2].onGlobalFilterOpen();

		expect(mocks.openGlobalFilterDialog).toHaveBeenCalledWith(expect.objectContaining({
			rows: dataset.rows,
			allColumns: ['region', 'value'],
			numericColumns: ['value'],
			initialFilter: expect.objectContaining({ rules: [] }),
			translate: mocks.t,
		}));
		expect(onDatasetConfigChange).toHaveBeenCalledWith({ globalFilter: nextFilter });
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
		const onDatasetConfigChange = vi.fn();

		render(makeDataset({ chartConfig: { globalFilter } }), { onDatasetConfigChange });

		// Checked before any dialog/token callback runs: those still write config
		// legitimately, but the render itself must not.
		expect(onDatasetConfigChange).not.toHaveBeenCalled();
		const triggerState = mocks.updateTabs.mock.calls[0][2].triggerState;
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

		render(makeDataset({ rows, columns, selectedColumns: ['value', 'score'] }));
		expect(mocks.renderColumnControlsDOM.mock.calls.at(-1)[0].activeFilter).toBe('numeric');

		render(makeDataset({ rows, columns, selectedColumns: ['region', 'category'] }));
		expect(mocks.renderColumnControlsDOM.mock.calls.at(-1)[0].activeFilter).toBe('text');

		render(makeDataset({ rows, columns, selectedColumns: ['region', 'value'] }));
		expect(mocks.renderColumnControlsDOM.mock.calls.at(-1)[0].activeFilter).toBeNull();

		render(makeDataset({ rows, columns }));
		expect(mocks.renderColumnControlsDOM.mock.calls.at(-1)[0].activeFilter).toBe('all');
	});

	it('handles missing preview selector, invalid preview row defaults, and no change callback', () => {
		document.getElementById('select-preview-rows').remove();
		const dataset = makeDataset({ rows: [{ region: 'A', value: 1 }] });

		expect(() => render(dataset, { previewRows: -5 })).not.toThrow();

		expect(mocks.renderTablePreview).toHaveBeenCalledWith(dataset.rows, COLUMNS, 10);
	});

	it('writes the file summary from the dataset', () => {
		render(makeDataset());

		expect(document.getElementById('file-summary-text').title).toBe('data.csv · 2 rows · 2 columns · 2 KB');
	});

	it('handles global-filter dialog clear, cancel, and disabled callback paths', async () => {
		const onDatasetConfigChange = vi.fn();
		const dataset = makeDataset({ rows: [{ region: 'A', value: 1 }] });
		const cleared = { combine: 'AND', rules: [] };

		mocks.openGlobalFilterDialog.mockResolvedValueOnce({ action: 'clear', filter: cleared });
		render(dataset, { onDatasetConfigChange });
		await mocks.updateTabs.mock.calls.at(-1)[2].onGlobalFilterOpen();
		expect(onDatasetConfigChange).toHaveBeenCalledWith({ globalFilter: cleared });

		mocks.openGlobalFilterDialog.mockResolvedValueOnce(null);
		render(dataset, { onDatasetConfigChange });
		await mocks.updateTabs.mock.calls.at(-1)[2].onGlobalFilterOpen();
		expect(onDatasetConfigChange).toHaveBeenCalledTimes(1);

		render(dataset, { onDatasetConfigChange: null });
		await mocks.updateTabs.mock.calls.at(-1)[2].onGlobalFilterOpen();
		expect(mocks.openGlobalFilterDialog).toHaveBeenCalledTimes(2);
	});
});
