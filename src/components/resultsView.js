import { calcularEstatisticas } from '../services/dataService.js';

const LINHAS_PREVIEW = 10;

export function formatarNumero(valor) {
	if (valor === null || valor === undefined || isNaN(valor)) return '—';
	if (Number.isInteger(valor)) return valor.toLocaleString('pt-BR');
	if (Math.abs(valor) >= 100) return valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
	if (Math.abs(valor) >= 1) return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

	return valor.toPrecision(4);
}

export function mostrarErro(mensagem) {
	const elemento = document.getElementById('mensagem-erro');
	elemento.textContent = '⚠ ' + mensagem;
	elemento.style.display = 'block';
}

export function esconderErro() {
	document.getElementById('mensagem-erro').style.display = 'none';
}

export function renderizarInterface(dados, colunas, nomeArquivo, tamanhoArquivo) {
	document.getElementById('info-arquivo').style.display = 'block';
	document.getElementById('arquivo-nome-texto').textContent = nomeArquivo;
	document.getElementById('arquivo-meta-texto').textContent =
		`${dados.length.toLocaleString('pt-BR')} linhas · ${colunas.length} colunas · ${tamanhoArquivo}`;

	document.getElementById('painel-colunas').style.display = 'block';
	const listaColunas = document.getElementById('lista-colunas-conteudo');
	listaColunas.innerHTML = colunas.map(({ nome, tipo }) => `
		<div class="coluna-item">
			<span class="coluna-nome" title="${nome}">${nome}</span>
			<span class="tipo-tag ${tipo}">${tipo}</span>
		</div>
	`).join('');

	document.getElementById('estado-vazio').style.display = 'none';
	const estadoDados = document.getElementById('estado-dados');
	estadoDados.style.display = 'flex';

	document.getElementById('badge-linhas').textContent =
		`${dados.length.toLocaleString('pt-BR')} linhas (mostrando ${Math.min(LINHAS_PREVIEW, dados.length)})`;

	const linhasPreview = dados.slice(0, LINHAS_PREVIEW);

	const cabecalhoHTML = colunas.map(({ nome, tipo }) =>
		`<th class="${tipo === 'numero' ? 'num' : ''}">${nome}</th>`
	).join('');

	const corpoHTML = linhasPreview.map(linha =>
		'<tr>' + colunas.map(({ nome, tipo }) => {
			const val = linha[nome];
			const exibir = val === null || val === undefined || val === ''
				? '—'
				: tipo === 'numero'
					? formatarNumero(val)
					: String(val);

			return `<td class="${tipo === 'numero' ? 'num' : ''}">${exibir}</td>`;
		}).join('') + '</tr>'
	).join('');

	const rodapeHTML = colunas.map(({ tipo }) => `<td>${tipo}</td>`).join('');

	document.getElementById('container-tabela').innerHTML = `
		<table class="tabela-preview">
			<thead><tr>${cabecalhoHTML}</tr></thead>
			<tbody>${corpoHTML}</tbody>
			<tfoot><tr>${rodapeHTML}</tr></tfoot>
		</table>
	`;

	const stats = calcularEstatisticas(dados, colunas);
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
	document.querySelector('.upload-texto-principal').textContent = 'Arquivo carregado';
	document.querySelector('.upload-texto-sub').textContent = 'Clique ou arraste para substituir';
}