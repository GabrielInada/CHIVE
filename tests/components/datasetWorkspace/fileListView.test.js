// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { renderFileListDOM } from '../../../src/components/datasetWorkspace/fileListView.js';

describe('fileListView', () => {
	it('renders file items and handles select/remove actions', () => {
		document.body.innerHTML = '<div id="lista"></div>';
		const lista = document.getElementById('lista');
		const aoSelecionar = vi.fn();
		const aoRemover = vi.fn();

		renderFileListDOM({
			lista,
			datasets: [
				{ name: 'A.csv', rows: [1, 2], columns: ['x'], sizeLabel: '1KB' },
				{ name: 'B.csv', rows: [1], columns: ['x', 'y'], sizeLabel: '2KB' },
			],
			indiceAtivo: 1,
			traduzir: (key, ...args) => `${key}:${args.join('|')}`,
			getLocale: () => 'en',
			aoSelecionar,
			aoRemover,
		});

		expect(lista.querySelectorAll('.file-item').length).toBe(2);
		expect(lista.querySelector('.file-item.active')).toBeTruthy();

		lista.querySelector('[data-acao="selecionar"][data-idx="0"]').click();
		expect(aoSelecionar).toHaveBeenCalledWith(0);

		lista.querySelector('[data-acao="remover"][data-idx="1"]').click();
		expect(aoRemover).toHaveBeenCalledWith(1);
	});

	it('filters case-insensitively, caps visible rows, and reports pagination', () => {
		document.body.innerHTML = '<div id="lista"></div>';
		const lista = document.getElementById('lista');
		const datasets = Array.from({ length: 4 }, (_, index) => ({
			name: index === 0 ? undefined : `Match-${index}.csv`,
			rows: [],
			columns: [],
			sizeLabel: `${index}KB`,
		}));

		const result = renderFileListDOM({
			lista,
			datasets,
			indiceAtivo: -1,
			traduzir: key => key,
			getLocale: () => 'en',
			aoSelecionar: vi.fn(),
			aoRemover: vi.fn(),
			filtro: 'MATCH',
			limiteVisivel: 2.8,
		});

		expect(result).toEqual({ total: 4, filtered: 3, rendered: 2, hasMore: true });
		expect(lista.querySelectorAll('.file-item').length).toBe(2);
	});

	it('renders no-match state and ignores invalid delegated clicks', () => {
		document.body.innerHTML = '<div id="lista"></div>';
		const lista = document.getElementById('lista');
		const aoSelecionar = vi.fn();

		const result = renderFileListDOM({
			lista,
			datasets: [{ name: 'A.csv', rows: [], columns: [], sizeLabel: '1KB' }],
			indiceAtivo: 0,
			traduzir: key => key,
			getLocale: () => 'en',
			aoSelecionar,
			aoRemover: vi.fn(),
			filtro: 'missing',
			limiteVisivel: 0,
		});

		expect(result.rendered).toBe(0);
		expect(result.hasMore).toBe(false);
		expect(lista.querySelector('.file-list-empty')?.textContent).toBe('chive-files-no-match');

		lista.click();
		const invalid = document.createElement('button');
		invalid.dataset.acao = 'selecionar';
		invalid.dataset.idx = 'not-a-number';
		lista.appendChild(invalid);
		invalid.click();
		expect(aoSelecionar).not.toHaveBeenCalled();
	});
});
