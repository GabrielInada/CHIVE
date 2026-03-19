import { calcularEstatisticas } from '../services/dataService.js';
import { t, obterLocale } from '../services/i18nService.js';
import { renderBarChart, renderScatterPlot } from '../modules/visualizations/index.js';
import { escaparHTML, formatarNumero } from '../utils/formatters.js';
import { filterVisibleColumns, getNumericColumnNames, getCategoricalColumnNames, getNumericColumns } from '../utils/columnHelpers.js';

function traduzirTipo(tipo) {
if (tipo === 'numero') return t('chive-type-number');
if (tipo === 'texto') return t('chive-type-text');
return tipo;
}

function mensagemChart(containerId, mensagem) {
const container = document.getElementById(containerId);
container.innerHTML = `<div class="chart-vazio">${mensagem}</div>`;
}

function atualizarTabs(abaAtiva, aoAlterarConfigGraficos, config) {
const tabPreview = document.getElementById('tab-preview');
const tabCharts = document.getElementById('tab-charts');
const tabPanel = document.getElementById('tab-panel');
const painelPreview = document.getElementById('painel-preview');
const painelCharts = document.getElementById('painel-charts');
const painelPanel = document.getElementById('painel-panel');
const previewAtivo = abaAtiva === 'preview';
const chartsAtivo = abaAtiva === 'charts';
const panelAtivo = abaAtiva === 'panel';

tabPreview.classList.toggle('ativo', previewAtivo);
tabCharts.classList.toggle('ativo', chartsAtivo);
tabPanel.classList.toggle('ativo', panelAtivo);
painelPreview.classList.toggle('ativo', previewAtivo);
painelCharts.classList.toggle('ativo', chartsAtivo);
painelPanel.classList.toggle('ativo', panelAtivo);

tabPreview.onclick = () => {
if (!aoAlterarConfigGraficos) return;
aoAlterarConfigGraficos({ ...config, aba: 'preview' });
};

tabCharts.onclick = () => {
if (!aoAlterarConfigGraficos) return;
aoAlterarConfigGraficos({ ...config, aba: 'charts' });
};

tabPanel.onclick = () => {
if (!aoAlterarConfigGraficos) return;
aoAlterarConfigGraficos({ ...config, aba: 'panel' });
};
}

function renderizarTabelaPreview(dados, colunasVisiveis, limite) {
if (colunasVisiveis.length === 0) {
document.getElementById('container-tabela').innerHTML =
`<div class="tabela-sem-colunas">${t('chive-no-columns-selected')}</div>`;
return;
}

const linhasPreviewDados = dados.slice(0, limite);
const cabecalhoHTML = colunasVisiveis.map(({ nome, tipo }) =>
`<th class="${tipo === 'numero' ? 'num' : ''}">${nome}</th>`
).join('');

const corpoHTML = linhasPreviewDados.map(linha =>
'<tr>' + colunasVisiveis.map(({ nome, tipo }) => {
const val = linha[nome];
const exibir = val === null || val === undefined || val === ''
? '—'
: (tipo === 'numero' ? formatarNumero(val) : String(val));
return `<td class="${tipo === 'numero' ? 'num' : ''}">${exibir}</td>`;
}).join('') + '</tr>'
).join('');

const rodapeHTML = colunasVisiveis.map(({ tipo }) => `<td>${traduzirTipo(tipo)}</td>`).join('');
document.getElementById('container-tabela').innerHTML = `
<table class="tabela-preview">
<thead><tr>${cabecalhoHTML}</tr></thead>
<tbody>${corpoHTML}</tbody>
<tfoot><tr>${rodapeHTML}</tr></tfoot>
</table>
`;
}

function renderizarStats(dados, colunasVisiveis) {
const stats = calcularEstatisticas(dados, colunasVisiveis);
const cardStats = document.getElementById('card-stats');

if (stats.length > 0) {
cardStats.style.display = 'block';
document.getElementById('badge-num-colunas').textContent = t('chive-stats-badge', stats.length);
document.getElementById('container-stats').innerHTML = stats.map(stat => `
<div class="stat-col">
<div class="stat-col-nome" title="${escaparHTML(stat.nome)}">${escaparHTML(stat.nome)}</div>
<div class="stat-linha"><span>${t('chive-stat-valid')}</span> <span>${stat.n.toLocaleString(obterLocale())}</span></div>
<div class="stat-linha"><span>${t('chive-stat-min')}</span> <span>${formatarNumero(stat.min)}</span></div>
<div class="stat-linha"><span>${t('chive-stat-max')}</span> <span>${formatarNumero(stat.max)}</span></div>
<div class="stat-linha"><span>${t('chive-stat-mean')}</span> <span>${formatarNumero(stat.media)}</span></div>
<div class="stat-linha"><span>${t('chive-stat-median')}</span> <span>${formatarNumero(stat.mediana)}</span></div>
</div>
`).join('');
return;
}

cardStats.style.display = 'none';
document.getElementById('container-stats').innerHTML = '';
}

function renderizarGraficos(config, dados, colunasVisiveis, colunasNumericasVisiveis) {
	const chartsGrid = document.getElementById('charts-grid');
	const emptyState = document.getElementById('charts-empty-state');
	const blocoBar = document.getElementById('chart-block-bar');
	const blocoScatter = document.getElementById('chart-block-scatter');

document.getElementById('badge-charts').textContent = t(
'chive-charts-badge',
colunasVisiveis.length,
colunasNumericasVisiveis.length
);

if (config.aba !== 'charts') {
		chartsGrid.style.display = 'grid';
		emptyState.style.display = 'none';
		blocoBar.style.display = 'block';
		blocoScatter.style.display = 'block';
document.getElementById('chart-bar-container').innerHTML = '';
document.getElementById('chart-scatter-container').innerHTML = '';
return;
}

if (!config.bar.enabled && !config.scatter.enabled) {
		chartsGrid.style.display = 'none';
		emptyState.style.display = 'flex';
		emptyState.textContent = t('chive-chart-empty-none');
		blocoBar.style.display = 'none';
		blocoScatter.style.display = 'none';
		document.getElementById('chart-bar-container').innerHTML = '';
		document.getElementById('chart-scatter-container').innerHTML = '';
return;
}

	chartsGrid.style.display = 'grid';
	emptyState.style.display = 'none';

if (config.bar.enabled) {
		blocoBar.style.display = 'block';
const barResult = renderBarChart(
document.getElementById('chart-bar-container'),
dados,
			config.bar.category,
			{
				ordenacao: config.bar.sort,
				topN: config.bar.topN,
				locale: obterLocale(),
				labels: {
					categoria: t('chive-chart-control-bar-category'),
					contagem: t('chive-tooltip-count'),
					percentual: t('chive-tooltip-percentage'),
				},
			}
);
if (!barResult.ok) mensagemChart('chart-bar-container', t('chive-chart-empty-bar'));
} else {
		blocoBar.style.display = 'none';
		document.getElementById('chart-bar-container').innerHTML = '';
}

if (config.scatter.enabled) {
		blocoScatter.style.display = 'block';
const scatterResult = renderScatterPlot(
document.getElementById('chart-scatter-container'),
dados,
config.scatter.x,
			config.scatter.y,
			{
				xScale: config.scatter.xScale,
				yScale: config.scatter.yScale,
				radius: config.scatter.radius,
				opacity: config.scatter.opacity,
				locale: obterLocale(),
				labels: {
					eixoX: t('chive-chart-control-scatter-x'),
					eixoY: t('chive-chart-control-scatter-y'),
					indice: t('chive-tooltip-row'),
				},
			}
);
		if (!scatterResult.ok) {
			const chave = scatterResult.reason === 'log-no-positive'
				? 'chive-chart-empty-scatter-log'
				: 'chive-chart-empty-scatter';
			mensagemChart('chart-scatter-container', t(chave));
		}
} else {
		blocoScatter.style.display = 'none';
		document.getElementById('chart-scatter-container').innerHTML = '';
}
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
resumo.textContent = t('chive-files-loaded', datasets.length);

lista.innerHTML = datasets.map((dataset, indice) => `
<div class="arquivo-item ${indice === indiceAtivo ? 'ativo' : ''}" data-idx="${indice}">
<button class="arquivo-item-botao" type="button" data-acao="selecionar" data-idx="${indice}">
<span class="arquivo-item-nome" title="${escaparHTML(dataset.nome)}">${escaparHTML(dataset.nome)}</span>
<span class="arquivo-item-meta">${t('chive-file-meta', dataset.dados.length.toLocaleString(obterLocale()), dataset.colunas.length, dataset.tamanho)}</span>
</button>
<button class="arquivo-item-remover" type="button" data-acao="remover" data-idx="${indice}" aria-label="${escaparHTML(t('chive-remove-file', dataset.nome))}">×</button>
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
document.getElementById('resultado-tabs').style.display = 'none';
document.getElementById('container-tabela').innerHTML = '';
document.getElementById('container-stats').innerHTML = '';
document.getElementById('chart-bar-container').innerHTML = '';
document.getElementById('chart-scatter-container').innerHTML = '';
document.getElementById('badge-charts').textContent = '—';
document.getElementById('btn-avancar').disabled = true;
const avisoDev = document.getElementById('aviso-dev');
if (avisoDev) avisoDev.style.display = 'none';
document.getElementById('zona-upload').classList.remove('carregado');
document.querySelector('.upload-icone').textContent = '⬆';
document.querySelector('.upload-texto-principal').textContent = t('chive-upload-main');
document.querySelector('.upload-texto-sub').innerHTML = t('chive-upload-sub');
}

export function renderizarInterface(
dados,
colunas,
nomeArquivo,
tamanhoArquivo,
linhasPreview = 10,
colunasSelecionadas = null,
aoAlterarSelecaoColuna = null,
configGraficos = null,
aoAlterarConfigGraficos = null
) {
document.getElementById('painel-colunas').style.display = 'block';
document.getElementById('resultado-tabs').style.display = 'flex';
document.getElementById('estado-vazio').style.display = 'none';
document.getElementById('estado-dados').style.display = 'flex';

const nomesColunas = colunas.map(coluna => coluna.nome);
const nomesSelecionados = new Set(Array.isArray(colunasSelecionadas) ? colunasSelecionadas : nomesColunas);
const colunasVisiveis = colunas.filter(coluna => nomesSelecionados.has(coluna.nome));
const colunasNumericasVisiveis = getNumericColumns(colunasVisiveis);

const config = configGraficos || {
aba: 'preview',
bar: { enabled: true, category: null },
scatter: { enabled: true, x: null, y: null },
};

// Detecta filtro ativo
const nomesNumericas = colunas.filter(c => c.tipo === 'numero').map(c => c.nome);
const nomesTexto = colunas.filter(c => c.tipo === 'texto').map(c => c.nome);
const selecionadasArray = [...nomesSelecionados];
const filtroAtivo =
  selecionadasArray.length === nomesColunas.length ? 'todas' :
  selecionadasArray.length === nomesNumericas.length && selecionadasArray.every(n => nomesNumericas.includes(n)) ? 'numericas' :
  selecionadasArray.length === nomesTexto.length && selecionadasArray.every(n => nomesTexto.includes(n)) ? 'texto' : null;

// Renderiza botões fora do scroll
const acoesContainer = document.getElementById('colunas-acoes');
acoesContainer.innerHTML = `
  <button class="colunas-acao ${filtroAtivo === 'todas' ? 'ativo' : ''}" type="button" data-acao-coluna="todas">${t('chive-action-select-all')}</button>
  <button class="colunas-acao" type="button" data-acao-coluna="limpar">${t('chive-action-clear')}</button>
  <button class="colunas-acao ${filtroAtivo === 'numericas' ? 'ativo' : ''}" type="button" data-acao-coluna="numericas">${t('chive-action-only-numeric')}</button>
  <button class="colunas-acao ${filtroAtivo === 'texto' ? 'ativo' : ''}" type="button" data-acao-coluna="texto">${t('chive-action-only-text')}</button>
`;
acoesContainer.onclick = evento => {
  const alvo = evento.target.closest('[data-acao-coluna]');
  if (!alvo || !aoAlterarSelecaoColuna) return;
  const acao = alvo.dataset.acaoColuna;
  if (acao === 'todas') { aoAlterarSelecaoColuna(nomesColunas); return; }
  if (acao === 'limpar') { aoAlterarSelecaoColuna([]); return; }
  if (acao === 'numericas') { aoAlterarSelecaoColuna(nomesNumericas); return; }
  if (acao === 'texto') { aoAlterarSelecaoColuna(nomesTexto); }
};

const listaColunas = document.getElementById('lista-colunas-conteudo');
listaColunas.innerHTML = colunas.map(({ nome, tipo }) => `
<label class="coluna-item" title="${escaparHTML(nome)}">
<input class="coluna-checkbox" type="checkbox" data-coluna="${escaparHTML(nome)}" ${nomesSelecionados.has(nome) ? 'checked' : ''} />
<span class="coluna-nome">${escaparHTML(nome)}</span>
<span class="tipo-tag ${tipo}">${traduzirTipo(tipo)}</span>
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

listaColunas.onchange = evento => {
const alvo = evento.target;
if (!(alvo instanceof HTMLInputElement) || alvo.type !== 'checkbox' || !aoAlterarSelecaoColuna) return;

const selecionados = Array.from(listaColunas.querySelectorAll('.coluna-checkbox:checked'))
.map(checkbox => checkbox.dataset.coluna)
.filter(Boolean);
aoAlterarSelecaoColuna(selecionados);
};

atualizarTabs(config.aba, aoAlterarConfigGraficos, config);

const limite = Number(linhasPreview) > 0 ? Number(linhasPreview) : 10;
document.getElementById('badge-linhas').textContent = t(
'chive-badge-preview',
dados.length.toLocaleString(obterLocale()),
Math.min(limite, dados.length),
colunasVisiveis.length,
colunas.length
);

renderizarTabelaPreview(dados, colunasVisiveis, limite);
renderizarStats(dados, colunasVisiveis);
renderizarGraficos(config, dados, colunasVisiveis, colunasNumericasVisiveis);

document.getElementById('btn-avancar').disabled = false;
const avisoDev = document.getElementById('aviso-dev');
if (avisoDev) avisoDev.style.display = 'block';
document.getElementById('zona-upload').classList.add('carregado');
document.querySelector('.upload-icone').textContent = '✓';
document.querySelector('.upload-texto-principal').textContent = t('chive-upload-loaded-main');
document.querySelector('.upload-texto-sub').textContent = t('chive-upload-loaded-sub');
document.getElementById('arquivo-resumo-texto').title =
`${nomeArquivo} · ${dados.length.toLocaleString(obterLocale())} linhas · ${colunas.length} colunas · ${tamanhoArquivo}`;
}
