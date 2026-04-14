export function renderFileListDOM({
	lista: list,
	datasets,
	indiceAtivo: activeIndex,
	traduzir: translate,
	getLocale,
	aoSelecionar: onSelect,
	aoRemover: onRemove,
	filtro = '',
	limiteVisivel = 15,
}) {
	list.innerHTML = '';

	const normalizedFilter = String(filtro || '').trim().toLowerCase();
	const indexedDatasets = datasets.map((dataset, index) => ({ dataset, index }));
	const filteredDatasets = normalizedFilter
		? indexedDatasets.filter(({ dataset }) => String(dataset.nome || '').toLowerCase().includes(normalizedFilter))
		: indexedDatasets;
	const safeLimit = Number.isFinite(limiteVisivel) && limiteVisivel > 0 ? Math.floor(limiteVisivel) : 15;
	const visibleDatasets = filteredDatasets.slice(0, safeLimit);

	visibleDatasets.forEach(({ dataset, index }) => {
		const item = document.createElement('div');
		item.className = `arquivo-item ${index === activeIndex ? 'ativo' : ''}`;
		item.dataset.idx = String(index);

		const selectButton = document.createElement('button');
		selectButton.className = 'arquivo-item-botao';
		selectButton.type = 'button';
		selectButton.dataset.acao = 'selecionar';
		selectButton.dataset.idx = String(index);

		const name = document.createElement('span');
		name.className = 'arquivo-item-nome';
		name.title = dataset.nome;
		name.textContent = dataset.nome;

		const meta = document.createElement('span');
		meta.className = 'arquivo-item-meta';
		meta.textContent = translate(
			'chive-file-meta',
			dataset.dados.length.toLocaleString(getLocale()),
			dataset.colunas.length,
			dataset.tamanho
		);

		const removeButton = document.createElement('button');
		removeButton.className = 'arquivo-item-remover';
		removeButton.type = 'button';
		removeButton.dataset.acao = 'remover';
		removeButton.dataset.idx = String(index);
		removeButton.setAttribute('aria-label', translate('chive-remove-file', dataset.nome));
		removeButton.textContent = '×';

		selectButton.appendChild(name);
		selectButton.appendChild(meta);
		item.appendChild(selectButton);
		item.appendChild(removeButton);
		list.appendChild(item);
	});

	if (filteredDatasets.length === 0) {
		const empty = document.createElement('div');
		empty.className = 'arquivo-lista-vazia';
		empty.textContent = translate('chive-files-no-match');
		list.appendChild(empty);
	}

	list.onclick = event => {
		const target = event.target.closest('[data-acao]');
		if (!target) return;

		const index = Number(target.dataset.idx);
		if (Number.isNaN(index)) return;

		if (target.dataset.acao === 'remover') {
			onRemove(index);
			return;
		}
		onSelect(index);
	};

	return {
		total: datasets.length,
		filtered: filteredDatasets.length,
		rendered: visibleDatasets.length,
		hasMore: filteredDatasets.length > visibleDatasets.length,
	};
}
