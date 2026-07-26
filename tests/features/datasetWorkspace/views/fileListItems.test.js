// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { renderFileListDOM } from '../../../../src/features/datasetWorkspace/views/fileListItems.js';

describe('fileListItems', () => {
	it('renders file items and handles select/remove actions', () => {
		document.body.innerHTML = '<div id="list"></div>';
		const list = document.getElementById('list');
		const onSelect = vi.fn();
		const onRemove = vi.fn();

		renderFileListDOM({
			list,
			datasets: [
				{ name: 'A.csv', rows: [1, 2], columns: ['x'], sizeLabel: '1KB' },
				{ name: 'B.csv', rows: [1], columns: ['x', 'y'], sizeLabel: '2KB' },
			],
			activeIndex: 1,
			translate: (key, ...args) => `${key}:${args.join('|')}`,
			getLocale: () => 'en',
			onSelect,
			onRemove,
		});

		expect(list.querySelectorAll('.file-item').length).toBe(2);
		expect(list.querySelector('.file-item.active')).toBeTruthy();

		list.querySelector('[data-file-action="select"][data-idx="0"]').click();
		expect(onSelect).toHaveBeenCalledWith(0);

		list.querySelector('[data-file-action="remove"][data-idx="1"]').click();
		expect(onRemove).toHaveBeenCalledWith(1);
	});

	it('filters case-insensitively, caps visible rows, and reports pagination', () => {
		document.body.innerHTML = '<div id="list"></div>';
		const list = document.getElementById('list');
		const datasets = Array.from({ length: 4 }, (_, index) => ({
			name: index === 0 ? undefined : `Match-${index}.csv`,
			rows: [],
			columns: [],
			sizeLabel: `${index}KB`,
		}));

		const result = renderFileListDOM({
			list,
			datasets,
			activeIndex: -1,
			translate: key => key,
			getLocale: () => 'en',
			onSelect: vi.fn(),
			onRemove: vi.fn(),
			filter: 'MATCH',
			visibleLimit: 2.8,
		});

		expect(result).toEqual({ total: 4, filtered: 3, rendered: 2, hasMore: true });
		expect(list.querySelectorAll('.file-item').length).toBe(2);
	});

	it('renders no-match state and ignores invalid delegated clicks', () => {
		document.body.innerHTML = '<div id="list"></div>';
		const list = document.getElementById('list');
		const onSelect = vi.fn();

		const result = renderFileListDOM({
			list,
			datasets: [{ name: 'A.csv', rows: [], columns: [], sizeLabel: '1KB' }],
			activeIndex: 0,
			translate: key => key,
			getLocale: () => 'en',
			onSelect,
			onRemove: vi.fn(),
			filter: 'missing',
			visibleLimit: 0,
		});

		expect(result.rendered).toBe(0);
		expect(result.hasMore).toBe(false);
		expect(list.querySelector('.file-list-empty')?.textContent).toBe('chive-files-no-match');

		list.click();
		const invalid = document.createElement('button');
		invalid.dataset.fileAction = 'select';
		invalid.dataset.idx = 'not-a-number';
		list.appendChild(invalid);
		invalid.click();
		expect(onSelect).not.toHaveBeenCalled();
	});
});
