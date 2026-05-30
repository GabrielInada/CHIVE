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
 * @param {Array<{ name: string, type: string }>} args.columns
 * @param {Set<string>} args.nomesSelecionados - Names of currently selected columns.
 * @param {'all' | 'numeric' | 'text' | null} args.filtroAtivo - Drives the "active" highlight on the action buttons.
 * @param {string[]} args.nomesColunas - All column names.
 * @param {string[]} args.nomesNumericas
 * @param {string[]} args.nomesTexto
 * @param {(key: string, ...args: *) => string} args.traduzir
 * @param {(type: string) => string} args.translateType
 * @param {(names: string[]) => void} args.aoAlterarSelecaoColuna - Fired with the new selection list.
 * @returns {void}
 */
export function renderColumnControlsDOM({
	acoesContainer,
	listaColunas,
	columns,
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

	const createActionButton = (acao, texto, active = false) => {
		const botao = document.createElement('button');
		botao.className = `column-action${active ? ' active' : ''}`;
		botao.type = 'button';
		botao.dataset.acaoColuna = acao;
		botao.textContent = texto;
		return botao;
	};

	acoesContainer.appendChild(createActionButton('all', traduzir('chive-action-select-all'), filtroAtivo === 'all'));
	acoesContainer.appendChild(createActionButton('clear', traduzir('chive-action-clear')));
	acoesContainer.appendChild(createActionButton('numeric', traduzir('chive-action-only-numeric'), filtroAtivo === 'numeric'));
	acoesContainer.appendChild(createActionButton('text', traduzir('chive-action-only-text'), filtroAtivo === 'text'));

	acoesContainer.onclick = evento => {
		const alvo = evento.target.closest('[data-acao-coluna]');
		if (!alvo || !aoAlterarSelecaoColuna) return;
		const acao = alvo.dataset.acaoColuna;
		if (acao === 'all') {
			aoAlterarSelecaoColuna(nomesColunas);
			return;
		}
		if (acao === 'clear') {
			aoAlterarSelecaoColuna([]);
			return;
		}
		if (acao === 'numeric') {
			aoAlterarSelecaoColuna(nomesNumericas);
			return;
		}
		if (acao === 'text') {
			aoAlterarSelecaoColuna(nomesTexto);
		}
	};

	listaColunas.replaceChildren();
	columns.forEach(({ name, type }) => {
		const label = document.createElement('label');
		label.className = 'column-item';
		label.title = name;

		const checkbox = document.createElement('input');
		checkbox.className = 'column-checkbox';
		checkbox.type = 'checkbox';
		checkbox.dataset.coluna = name;
		checkbox.checked = nomesSelecionados.has(name);

		const nomeSpan = document.createElement('span');
		nomeSpan.className = 'column-name';
		nomeSpan.textContent = name;

		const tipoSpan = document.createElement('span');
		tipoSpan.className = `type-tag ${type}`;
		tipoSpan.textContent = translateType(type);

		label.appendChild(checkbox);
		label.appendChild(nomeSpan);
		label.appendChild(tipoSpan);
		listaColunas.appendChild(label);
	});

	listaColunas.onchange = evento => {
		const alvo = evento.target;
		if (!(alvo instanceof HTMLInputElement) || alvo.type !== 'checkbox' || !aoAlterarSelecaoColuna) return;

		const selecionados = Array.from(listaColunas.querySelectorAll('.column-checkbox:checked'))
			.map(checkbox => checkbox.dataset.coluna)
			.filter(Boolean);
		aoAlterarSelecaoColuna(selecionados);
	};
}
