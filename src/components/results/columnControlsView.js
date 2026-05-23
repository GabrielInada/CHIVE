/**
 * Column-controls strip view. Renders the action buttons (All / Clear /
 * Only numeric / Only text) plus the per-column checkboxes.
 *
 * The action buttons swap the entire selection; the per-column checkboxes
 * emit the resolved set every time one is toggled.
 *
 * @param {Object} args
 * @param {HTMLElement} args.acoesContainer - Container for the action buttons.
 * @param {HTMLElement} args.listaColunas - Container for the per-column checkboxes.
 * @param {Array<{ nome: string, tipo: string }>} args.colunas
 * @param {Set<string>} args.nomesSelecionados - Names of currently selected columns.
 * @param {'todas' | 'numericas' | 'texto' | null} args.filtroAtivo - Drives the "active" highlight on the action buttons.
 * @param {string[]} args.nomesColunas - All column names.
 * @param {string[]} args.nomesNumericas
 * @param {string[]} args.nomesTexto
 * @param {(key: string, ...args: *) => string} args.traduzir
 * @param {(tipo: string) => string} args.translateType
 * @param {(names: string[]) => void} args.aoAlterarSelecaoColuna - Fired with the new selection list.
 * @returns {void}
 */
export function renderColumnControlsDOM({
	acoesContainer,
	listaColunas,
	colunas,
	nomesSelecionados,
	filtroAtivo,
	nomesColunas,
	nomesNumericas,
	nomesTexto,
	traduzir,
	translateType,
	aoAlterarSelecaoColuna,
}) {
	acoesContainer.replaceChildren();

	const createActionButton = (acao, texto, ativo = false) => {
		const botao = document.createElement('button');
		botao.className = `colunas-acao${ativo ? ' ativo' : ''}`;
		botao.type = 'button';
		botao.dataset.acaoColuna = acao;
		botao.textContent = texto;
		return botao;
	};

	acoesContainer.appendChild(createActionButton('todas', traduzir('chive-action-select-all'), filtroAtivo === 'todas'));
	acoesContainer.appendChild(createActionButton('limpar', traduzir('chive-action-clear')));
	acoesContainer.appendChild(createActionButton('numericas', traduzir('chive-action-only-numeric'), filtroAtivo === 'numericas'));
	acoesContainer.appendChild(createActionButton('texto', traduzir('chive-action-only-text'), filtroAtivo === 'texto'));

	acoesContainer.onclick = evento => {
		const alvo = evento.target.closest('[data-acao-coluna]');
		if (!alvo || !aoAlterarSelecaoColuna) return;
		const acao = alvo.dataset.acaoColuna;
		if (acao === 'todas') {
			aoAlterarSelecaoColuna(nomesColunas);
			return;
		}
		if (acao === 'limpar') {
			aoAlterarSelecaoColuna([]);
			return;
		}
		if (acao === 'numericas') {
			aoAlterarSelecaoColuna(nomesNumericas);
			return;
		}
		if (acao === 'texto') {
			aoAlterarSelecaoColuna(nomesTexto);
		}
	};

	listaColunas.replaceChildren();
	colunas.forEach(({ nome, tipo }) => {
		const label = document.createElement('label');
		label.className = 'coluna-item';
		label.title = nome;

		const checkbox = document.createElement('input');
		checkbox.className = 'coluna-checkbox';
		checkbox.type = 'checkbox';
		checkbox.dataset.coluna = nome;
		checkbox.checked = nomesSelecionados.has(nome);

		const nomeSpan = document.createElement('span');
		nomeSpan.className = 'coluna-nome';
		nomeSpan.textContent = nome;

		const tipoSpan = document.createElement('span');
		tipoSpan.className = `tipo-tag ${tipo}`;
		tipoSpan.textContent = translateType(tipo);

		label.appendChild(checkbox);
		label.appendChild(nomeSpan);
		label.appendChild(tipoSpan);
		listaColunas.appendChild(label);
	});

	listaColunas.onchange = evento => {
		const alvo = evento.target;
		if (!(alvo instanceof HTMLInputElement) || alvo.type !== 'checkbox' || !aoAlterarSelecaoColuna) return;

		const selecionados = Array.from(listaColunas.querySelectorAll('.coluna-checkbox:checked'))
			.map(checkbox => checkbox.dataset.coluna)
			.filter(Boolean);
		aoAlterarSelecaoColuna(selecionados);
	};
}
