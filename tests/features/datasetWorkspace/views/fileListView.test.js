// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn((key, ...args) => (args.length ? `${key}:${args.join(',')}` : key)),
	getLocale: vi.fn(() => 'en'),
	renderFileListDOM: vi.fn(),
	openJoinBuilderDialog: vi.fn(),
	openPresetDatasetsDialog: vi.fn(),
}));

vi.mock('../../../../src/services/i18nService.js', () => ({
	t: mocks.t,
	getLocale: mocks.getLocale,
}));

vi.mock('../../../../src/features/datasetWorkspace/views/fileListItems.js', () => ({
	renderFileListDOM: mocks.renderFileListDOM,
}));

vi.mock('../../../../src/features/datasetWorkspace/dialogs/joinBuilderView.js', () => ({
	openJoinBuilderDialog: mocks.openJoinBuilderDialog,
}));

vi.mock('../../../../src/features/datasetWorkspace/dialogs/presetDatasetsView.js', () => ({
	openPresetDatasetsDialog: mocks.openPresetDatasetsDialog,
}));

import { renderFileList } from '../../../../src/features/datasetWorkspace/views/fileListView.js';

function setupFileListDom() {
	document.body.innerHTML = `
		<section id="file-info">
			<div id="file-summary-text"></div>
			<div id="file-list-content"></div>
		</section>
	`;
}

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
