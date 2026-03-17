import { calcularEstatisticas } from '../services/dataService.js';

function escaparHTML(texto) {
	return String(texto)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

export function formatarNumero(valor) {
	const numero = Number(valor);
	if (valor === null || valor === undefined || valor === '' || Number.isNaN(numero)) return '—';
	if (Number.isInteger(numero)) return numero.toLocaleString('pt-BR');
	if (Math.abs(numero) >= 100) return numero.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
	if (Math.abs(numero) >= 1) return numero.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

	return numero.toPrecision(4);
}

export function mostrarErro(mensagem) {
	const elemento = document.getElementById('mensagem-erro');
	elemento.textContent = '⚠ ' + mensagem;
	elemento.style.display = 'block';
}

export function esconderErro() {
	document.getElementById('mensagem-erro').style.display = 'none';
}

export function renderizarListaArquivos(datasets, indiceAtivo, aoSelecionar, aoRemover) {
	const infoArquivo = document.getElementById('info-arquivo');
	const resumo = document.getElementById('arquivo-resumo-texto');
	const lista = document.getElementById('lista-arquivos-conteudo');

	infoArquivo.style.display = 'block';
	resumo.textContent = `${datasets.length} arquivo${datasets.length > 1 ? 's' : ''} carregado${datasets.length > 1 ? 's' : ''}`;

	lista.innerHTML = datasets.map((dataset, indice) => `
		<div class="arquivo-item ${indice === indiceAtivo ? 'ativo' : ''}" data-idx="${indice}">
			<button class="arquivo-item-botao" type="button" data-acao="selecionar" data-idx="${indice}">
				<span class="arquivo-item-nome" title="${escaparHTML(dataset.nome)}">${escaparHTML(dataset.nome)}</span>
				<span class="arquivo-item-meta">${dataset.dados.length.toLocaleString('pt-BR')} linhas · ${dataset.colunas.length} colunas · ${dataset.tamanho}</span>
			</button>
			<button class="arquivo-item-remover" type="button" data-acao="remover" data-idx="${indice}" aria-label="Remover ${escaparHTML(dataset.nome)}">×</button>
		</div>
	`).join('');

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

export function renderizarEstadoVazio() {
	document.getElementById('info-arquivo').style.display = 'none';
	document.getElementById('painel-colunas').style.display = 'none';
	document.getElementById('estado-vazio').style.display = 'flex';
	document.getElementById('estado-dados').style.display = 'none';
	document.getElementById('container-tabela').innerHTML = '';
	document.getElementById('container-stats').innerHTML = '';
	document.getElementById('btn-avancar').disabled = true;
	document.getElementById('aviso-dev').style.display = 'none';
	document.getElementById('zona-upload').classList.remove('carregado');
	document.querySelector('.upload-icone').textContent = '⬆';
	document.querySelector('.upload-texto-principal').textContent = 'Arraste seu arquivo aqui';
	document.querySelector('.upload-texto-sub').innerHTML =
		'ou clique para selecionar<br>Formatos aceitos: <strong>CSV</strong> ou <strong>JSON</strong>';
}

export function renderizarInterface(
	dados,
	colunas,
	nomeArquivo,
	tamanhoArquivo,
	linhasPreview = 10,
	colunasSelecionadas = null,
	aoAlterarSelecaoColuna = null
) {
	document.getElementById('painel-colunas').style.display = 'block';
	const nomesColunas = colunas.map(coluna => coluna.nome);
	const nomesSelecionados = new Set(
		(Array.isArray(colunasSelecionadas) && colunasSelecionadas.length > 0)
			? colunasSelecionadas
			: nomesColunas
	);
	const colunasVisiveis = colunas.filter(coluna => nomesSelecionados.has(coluna.nome));

	const listaColunas = document.getElementById('lista-colunas-conteudo');
	listaColunas.innerHTML = colunas.map(({ nome, tipo }) => `
		<label class="coluna-item" title="${escaparHTML(nome)}">
			<input class="coluna-checkbox" type="checkbox" data-coluna="${escaparHTML(nome)}" ${nomesSelecionados.has(nome) ? 'checked' : ''} />
			<span class="coluna-nome">${escaparHTML(nome)}</span>
			<span class="tipo-tag ${tipo}">${tipo}</span>
		</label>
	`).join('');

	listaColunas.onchange = evento => {
		const alvo = evento.target;
		if (!(alvo instanceof HTMLInputElement) || alvo.type !== 'checkbox' || !aoAlterarSelecaoColuna) return;

		const selecionados = Array.from(listaColunas.querySelectorAll('.coluna-checkbox:checked'))
			.map(checkbox => checkbox.dataset.coluna)
			.filter(Boolean);

		aoAlterarSelecaoColuna(selecionados);
	};

	document.getElementById('estado-vazio').style.display = 'none';
	const estadoDados = document.getElementById('estado-dados');
	estadoDados.style.display = 'flex';

	const limite = Number(linhasPreview) > 0 ? Number(linhasPreview) : 10;

	document.getElementById('badge-linhas').textContent =
		`${dados.length.toLocaleString('pt-BR')} linhas (mostrando ${Math.min(limite, dados.length)}) · ${colunasVisiveis.length}/${colunas.length} colunas`;

	const linhasPreviewDados = dados.slice(0, limite);

	const cabecalhoHTML = colunasVisiveis.map(({ nome, tipo }) =>
		`<th class="${tipo === 'numero' ? 'num' : ''}">${nome}</th>`
	).join('');

	const corpoHTML = linhasPreviewDados.map(linha =>
		'<tr>' + colunasVisiveis.map(({ nome, tipo }) => {
			const val = linha[nome];
			const exibir = val === null || val === undefined || val === ''
				? '—'
				: tipo === 'numero'
					? formatarNumero(val)
					: String(val);

			return `<td class="${tipo === 'numero' ? 'num' : ''}">${exibir}</td>`;
		}).join('') + '</tr>'
	).join('');

	if (colunasVisiveis.length === 0) {
		document.getElementById('container-tabela').innerHTML =
			'<div class="tabela-sem-colunas">Selecione ao menos uma coluna para renderizar o preview.</div>';
	} else {
		const rodapeHTML = colunasVisiveis.map(({ tipo }) => `<td>${tipo}</td>`).join('');

		document.getElementById('container-tabela').innerHTML = `
			<table class="tabela-preview">
				<thead><tr>${cabecalhoHTML}</tr></thead>
				<tbody>${corpoHTML}</tbody>
				<tfoot><tr>${rodapeHTML}</tr></tfoot>
			</table>
		`;
	}

	const stats = calcularEstatisticas(dados, colunasVisiveis);
	const cardStats = document.getElementById('card-stats');

	if (stats.length > 0) {
		cardStats.style.display = 'block';
		document.getElementById('badge-num-colunas').textContent =
			`${stats.length} coluna${stats.length > 1 ? 's' : ''} numérica${stats.length > 1 ? 's' : ''}`;

		document.getElementById('container-stats').innerHTML = stats.map(stat => `
			<div class="stat-col">
				<div class="stat-col-nome" title="${stat.nome}">${stat.nome}</div>
				<div class="stat-linha"><span>n válidos</span> <span>${stat.n.toLocaleString('pt-BR')}</span></div>
				<div class="stat-linha"><span>mínimo</span> <span>${formatarNumero(stat.min)}</span></div>
				<div class="stat-linha"><span>máximo</span> <span>${formatarNumero(stat.max)}</span></div>
				<div class="stat-linha"><span>média</span> <span>${formatarNumero(stat.media)}</span></div>
				<div class="stat-linha"><span>mediana</span> <span>${formatarNumero(stat.mediana)}</span></div>
			</div>
		`).join('');
	} else {
		cardStats.style.display = 'none';
		document.getElementById('container-stats').innerHTML = '';
	}

	document.getElementById('btn-avancar').disabled = false;
	document.getElementById('aviso-dev').style.display = 'block';
	document.getElementById('zona-upload').classList.add('carregado');
	document.querySelector('.upload-icone').textContent = '✓';
	document.querySelector('.upload-texto-principal').textContent = 'Arquivo(s) carregado(s)';
	document.querySelector('.upload-texto-sub').textContent = 'Clique ou arraste para adicionar mais';
	document.getElementById('arquivo-resumo-texto').title =
		`${nomeArquivo} · ${dados.length.toLocaleString('pt-BR')} linhas · ${colunas.length} colunas · ${tamanhoArquivo}`;
}