export function renderizarControlesColunasDOM({
	acoesContainer,
	listaColunas,
	colunas,
	nomesSelecionados,
	filtroAtivo,
	nomesColunas,
	nomesNumericas,
	nomesTexto,
	traduzir,
	traduzirTipo,
	aoAlterarSelecaoColuna,
}) {
	acoesContainer.innerHTML = '';

	const criarBotaoAcao = (acao, texto, ativo = false) => {
		const botao = document.createElement('button');
		botao.className = `colunas-acao${ativo ? ' ativo' : ''}`;
		botao.type = 'button';
		botao.dataset.acaoColuna = acao;
		botao.textContent = texto;
		return botao;
	};

	acoesContainer.appendChild(criarBotaoAcao('todas', traduzir('chive-action-select-all'), filtroAtivo === 'todas'));
	acoesContainer.appendChild(criarBotaoAcao('limpar', traduzir('chive-action-clear')));
	acoesContainer.appendChild(criarBotaoAcao('numericas', traduzir('chive-action-only-numeric'), filtroAtivo === 'numericas'));
	acoesContainer.appendChild(criarBotaoAcao('texto', traduzir('chive-action-only-text'), filtroAtivo === 'texto'));

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

	listaColunas.innerHTML = '';
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
		tipoSpan.textContent = traduzirTipo(tipo);

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
