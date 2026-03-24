// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { renderFileListDOM } from '../../../src/components/results/fileListView.js';

describe('fileListView', () => {
	it('renders file items and handles select/remove actions', () => {
		document.body.innerHTML = '<div id="lista"></div>';
		const lista = document.getElementById('lista');
		const aoSelecionar = vi.fn();
		const aoRemover = vi.fn();

		renderFileListDOM({
			lista,
			datasets: [
				{ nome: 'A.csv', dados: [1, 2], colunas: ['x'], tamanho: '1KB' },
				{ nome: 'B.csv', dados: [1], colunas: ['x', 'y'], tamanho: '2KB' },
			],
			indiceAtivo: 1,
			traduzir: (key, ...args) => `${key}:${args.join('|')}`,
			getLocale: () => 'en',
			aoSelecionar,
			aoRemover,
		});

		expect(lista.querySelectorAll('.arquivo-item').length).toBe(2);
		expect(lista.querySelector('.arquivo-item.ativo')).toBeTruthy();

		lista.querySelector('[data-acao="selecionar"][data-idx="0"]').click();
		expect(aoSelecionar).toHaveBeenCalledWith(0);

		lista.querySelector('[data-acao="remover"][data-idx="1"]').click();
		expect(aoRemover).toHaveBeenCalledWith(1);
	});
});
