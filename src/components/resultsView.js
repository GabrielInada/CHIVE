import { calcularEstatisticas } from '../services/dataService.js';
import { t, obterLocale } from '../services/i18nService.js';
import { renderBarChart, renderScatterPlot } from '../modules/visualizations/index.js';
import { formatarNumero } from '../utils/formatters.js';
import { getNumericColumns } from '../utils/columnHelpers.js';
import { renderizarListaArquivosDOM } from './results/fileListView.js';
import { renderizarControlesColunasDOM } from './results/columnControlsView.js';

function traduzirTipo(tipo) {
if (tipo === 'numero') return t('chive-type-number');
if (tipo === 'texto') return t('chive-type-text');
return tipo;
}

function mensagemChart(containerId, mensagem) {
const container = document.getElementById(containerId);
container.innerHTML = '';
const vazio = document.createElement('div');
vazio.className = 'chart-vazio';
vazio.textContent = mensagem;
container.appendChild(vazio);
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
const containerTabela = document.getElementById('container-tabela');
if (colunasVisiveis.length === 0) {
containerTabela.innerHTML = '';
const vazio = document.createElement('div');
vazio.className = 'tabela-sem-colunas';
vazio.textContent = t('chive-no-columns-selected');
containerTabela.appendChild(vazio);
return;
}

const linhasPreviewDados = dados.slice(0, limite);
const tabela = document.createElement('table');
tabela.className = 'tabela-preview';

const thead = document.createElement('thead');
const trHead = document.createElement('tr');
colunasVisiveis.forEach(({ nome, tipo }) => {
const th = document.createElement('th');
if (tipo === 'numero') th.classList.add('num');
th.textContent = nome;
trHead.appendChild(th);
});
thead.appendChild(trHead);

const tbody = document.createElement('tbody');
linhasPreviewDados.forEach(linha => {
const tr = document.createElement('tr');
colunasVisiveis.forEach(({ nome, tipo }) => {
const td = document.createElement('td');
if (tipo === 'numero') td.classList.add('num');
const val = linha[nome];
const exibir = val === null || val === undefined || val === ''
? '—'
: (tipo === 'numero' ? formatarNumero(val) : String(val));
td.textContent = exibir;
tr.appendChild(td);
});
tbody.appendChild(tr);
});

const tfoot = document.createElement('tfoot');
const trFoot = document.createElement('tr');
colunasVisiveis.forEach(({ tipo }) => {
const td = document.createElement('td');
td.textContent = traduzirTipo(tipo);
trFoot.appendChild(td);
});
tfoot.appendChild(trFoot);

tabela.appendChild(thead);
tabela.appendChild(tbody);
tabela.appendChild(tfoot);

containerTabela.innerHTML = '';
containerTabela.appendChild(tabela);
}

function renderizarStats(dados, colunasVisiveis) {
const stats = calcularEstatisticas(dados, colunasVisiveis);
const cardStats = document.getElementById('card-stats');

if (stats.length > 0) {
cardStats.style.display = 'block';
document.getElementById('badge-num-colunas').textContent = t('chive-stats-badge', stats.length);
const containerStats = document.getElementById('container-stats');
containerStats.innerHTML = '';

const criarLinhaStat = (label, valor) => {
const linha = document.createElement('div');
linha.className = 'stat-linha';
const spanLabel = document.createElement('span');
spanLabel.textContent = label;
const spanValor = document.createElement('span');
spanValor.textContent = valor;
linha.appendChild(spanLabel);
linha.appendChild(spanValor);
return linha;
};

stats.forEach(stat => {
const coluna = document.createElement('div');
coluna.className = 'stat-col';

const nome = document.createElement('div');
nome.className = 'stat-col-nome';
nome.title = stat.nome;
nome.textContent = stat.nome;

coluna.appendChild(nome);
coluna.appendChild(criarLinhaStat(t('chive-stat-valid'), stat.n.toLocaleString(obterLocale())));
coluna.appendChild(criarLinhaStat(t('chive-stat-min'), formatarNumero(stat.min)));
coluna.appendChild(criarLinhaStat(t('chive-stat-max'), formatarNumero(stat.max)));
coluna.appendChild(criarLinhaStat(t('chive-stat-mean'), formatarNumero(stat.media)));
coluna.appendChild(criarLinhaStat(t('chive-stat-median'), formatarNumero(stat.mediana)));

containerStats.appendChild(coluna);
});
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

renderizarListaArquivosDOM({
lista,
datasets,
indiceAtivo,
traduzir: t,
obterLocale,
aoSelecionar,
aoRemover,
});
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
document.querySelector('.upload-texto-sub').textContent = t('chive-upload-sub');
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
const listaColunas = document.getElementById('lista-colunas-conteudo');

renderizarControlesColunasDOM({
acoesContainer,
listaColunas,
colunas,
nomesSelecionados,
filtroAtivo,
nomesColunas,
nomesNumericas,
nomesTexto,
traduzir: t,
traduzirTipo,
aoAlterarSelecaoColuna,
});

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
