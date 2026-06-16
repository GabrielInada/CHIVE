// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { renderColumnControlsDOM } from '../../../src/components/results/columnControlsView.js';

describe('columnControlsView', () => {
	it('renders action buttons and checkbox list, then emits selections', () => {
		document.body.innerHTML = '<div id="acoes"></div><div id="lista"></div>';
		const acoesContainer = document.getElementById('acoes');
		const listaColunas = document.getElementById('lista');
		const aoAlterarSelecaoColuna = vi.fn();

		renderColumnControlsDOM({
			acoesContainer,
			listaColunas,
			columns: [
				{ name: 'cidade', type: 'text' },
				{ name: 'valor', type: 'number' },
			],
			nomesSelecionados: new Set(['cidade']),
			filtroAtivo: 'text',
			nomesColunas: ['cidade', 'valor'],
			nomesNumericas: ['valor'],
			nomesTexto: ['cidade'],
			traduzir: key => key,
			translateType: type => type,
			aoAlterarSelecaoColuna,
		});

		expect(acoesContainer.querySelectorAll('[data-acao-coluna]').length).toBe(4);
		expect(listaColunas.querySelectorAll('.column-checkbox').length).toBe(2);

		acoesContainer.querySelector('[data-acao-coluna="numeric"]').click();
		expect(aoAlterarSelecaoColuna).toHaveBeenCalledWith(['valor']);

		const checkboxes = listaColunas.querySelectorAll('.column-checkbox');
		checkboxes[1].checked = true;
		checkboxes[1].dispatchEvent(new Event('change', { bubbles: true }));
		expect(aoAlterarSelecaoColuna).toHaveBeenCalledWith(['cidade', 'valor']);
	});

	it('handles all, clear, and text action buttons', () => {
		document.body.innerHTML = '<div id="acoes"></div><div id="lista"></div>';
		const aoAlterarSelecaoColuna = vi.fn();

		renderColumnControlsDOM({
			acoesContainer: document.getElementById('acoes'),
			listaColunas: document.getElementById('lista'),
			columns: [
				{ name: 'cidade', type: 'text' },
				{ name: 'valor', type: 'number' },
			],
			nomesSelecionados: new Set(['cidade', 'valor']),
			filtroAtivo: 'all',
			nomesColunas: ['cidade', 'valor'],
			nomesNumericas: ['valor'],
			nomesTexto: ['cidade'],
			traduzir: key => key,
			translateType: type => type,
			aoAlterarSelecaoColuna,
		});

		expect(document.querySelector('[data-acao-coluna="all"]').classList.contains('active')).toBe(true);
		document.querySelector('[data-acao-coluna="all"]').click();
		document.querySelector('[data-acao-coluna="clear"]').click();
		document.querySelector('[data-acao-coluna="text"]').click();

		expect(aoAlterarSelecaoColuna).toHaveBeenNthCalledWith(1, ['cidade', 'valor']);
		expect(aoAlterarSelecaoColuna).toHaveBeenNthCalledWith(2, []);
		expect(aoAlterarSelecaoColuna).toHaveBeenNthCalledWith(3, ['cidade']);
	});

	it('guards missing callbacks and non-checkbox change events', () => {
		document.body.innerHTML = '<div id="acoes"></div><div id="lista"></div>';
		const acoesContainer = document.getElementById('acoes');
		const listaColunas = document.getElementById('lista');

		renderColumnControlsDOM({
			acoesContainer,
			listaColunas,
			columns: [{ name: 'cidade', type: 'text' }],
			nomesSelecionados: new Set(),
			filtroAtivo: 'text',
			nomesColunas: ['cidade'],
			nomesNumericas: [],
			nomesTexto: ['cidade'],
			traduzir: key => key,
			translateType: type => type,
		});

		expect(document.querySelector('[data-acao-coluna="text"]').classList.contains('active')).toBe(true);
		expect(() => {
			acoesContainer.click();
			document.querySelector('[data-acao-coluna="text"]').click();
			listaColunas.dispatchEvent(new Event('change', { bubbles: true }));
		}).not.toThrow();
	});
});
