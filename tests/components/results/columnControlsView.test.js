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
});
