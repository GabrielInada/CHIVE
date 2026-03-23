import { t, obterLocale } from '../services/i18nService.js';
import { getNumericColumns } from '../utils/columnHelpers.js';
import { atualizarTabs } from './results/tabsView.js';
import { renderizarTabelaPreview } from './results/tablePreviewView.js';
import { renderizarStats } from './results/statsView.js';
import { renderizarGraficos } from './results/chartsView.js';
import { renderizarListaArquivosDOM } from './results/fileListView.js';
import { renderizarControlesColunasDOM } from './results/columnControlsView.js';
import { mergeChartConfigWithDefaults } from '../modules/chartConfigDefaults.js';

function traduzirTipo(tipo) {
  if (tipo === 'numero') return t('chive-type-number');
  if (tipo === 'texto') return t('chive-type-text');
  return tipo;
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
document.getElementById('chart-network-container').innerHTML = '';
document.getElementById('chart-pie-container').innerHTML = '';
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

const config = mergeChartConfigWithDefaults(configGraficos);

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
