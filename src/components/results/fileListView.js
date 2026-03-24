export function renderFileListDOM({
	lista,
	datasets,
	indiceAtivo,
	traduzir,
	getLocale,
	aoSelecionar,
	aoRemover,
}) {
	lista.innerHTML = '';

	datasets.forEach((dataset, indice) => {
		const item = document.createElement('div');
		item.className = `arquivo-item ${indice === indiceAtivo ? 'ativo' : ''}`;
		item.dataset.idx = String(indice);

		const botaoSelecionar = document.createElement('button');
		botaoSelecionar.className = 'arquivo-item-botao';
		botaoSelecionar.type = 'button';
		botaoSelecionar.dataset.acao = 'selecionar';
		botaoSelecionar.dataset.idx = String(indice);

		const nome = document.createElement('span');
		nome.className = 'arquivo-item-nome';
		nome.title = dataset.nome;
		nome.textContent = dataset.nome;

		const meta = document.createElement('span');
		meta.className = 'arquivo-item-meta';
		meta.textContent = traduzir(
			'chive-file-meta',
			dataset.dados.length.toLocaleString(getLocale()),
			dataset.colunas.length,
			dataset.tamanho
		);

		const botaoRemover = document.createElement('button');
		botaoRemover.className = 'arquivo-item-remover';
		botaoRemover.type = 'button';
		botaoRemover.dataset.acao = 'remover';
		botaoRemover.dataset.idx = String(indice);
		botaoRemover.setAttribute('aria-label', traduzir('chive-remove-file', dataset.nome));
		botaoRemover.textContent = '×';

		botaoSelecionar.appendChild(nome);
		botaoSelecionar.appendChild(meta);
		item.appendChild(botaoSelecionar);
		item.appendChild(botaoRemover);
		lista.appendChild(item);
	});

	lista.onclick = evento => {
		const alvo = evento.target.closest('[data-acao]');
		if (!alvo) return;

		const indice = Number(alvo.dataset.idx);
		if (Number.isNaN(indice)) return;

		if (alvo.dataset.acao === 'remover') {
			aoRemover(indice);
			return;
		}
		aoSelecionar(indice);
	};
}
