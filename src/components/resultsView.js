import { t, getLocale } from '../services/i18nService.js';
import { mergeChartConfigWithDefaults } from '../config/chartDefaults.js';
import { renderCharts } from '../features/chartFeatures/index.js';
import { getNumericColumns } from '../utils/columnHelpers.js';

import { updateTabs } from './results/tabsView.js';
import { renderTablePreview } from './results/tablePreviewView.js';
import { renderStats } from './results/statsView.js';
import { renderFileListDOM } from './results/fileListView.js';
import { renderColumnControlsDOM } from './results/columnControlsView.js';

function translateType(tipo) {
  if (tipo === 'numero') return t('chive-type-number');
  if (tipo === 'texto') return t('chive-type-text');
  return tipo;
}

export function showErrorMessage(mensagem) {
  const elemento = document.getElementById('mensagem-erro');
  elemento.textContent = '⚠ ' + mensagem;
  elemento.style.display = 'block';
}

export function hideErrorMessage() {
  document.getElementById('mensagem-erro').style.display = 'none';
}

export function renderFileList(datasets, indiceAtivo, aoSelecionar, aoRemover) {
  const infoArquivo = document.getElementById('info-arquivo');
  const resumo = document.getElementById('arquivo-resumo-texto');
  const lista = document.getElementById('lista-arquivos-conteudo');

  infoArquivo.style.display = 'block';
  resumo.textContent = t('chive-files-loaded', datasets.length);

  renderFileListDOM({
    lista,
    datasets,
    indiceAtivo,
    traduzir: t,
    getLocale,
    aoSelecionar,
    aoRemover,
  });
}

export function renderEmptyState() {
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

export function renderDataInterface(
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
    selecionadasArray.length === nomesColunas.length ? 'todas'
      : selecionadasArray.length === nomesNumericas.length && selecionadasArray.every(n => nomesNumericas.includes(n)) ? 'numericas'
        : selecionadasArray.length === nomesTexto.length && selecionadasArray.every(n => nomesTexto.includes(n)) ? 'texto'
          : null;

  // Renderiza botões fora do scroll
  const acoesContainer = document.getElementById('colunas-acoes');
  const listaColunas = document.getElementById('lista-colunas-conteudo');

  renderColumnControlsDOM({
    acoesContainer,
    listaColunas,
    colunas,
    nomesSelecionados,
    filtroAtivo,
    nomesColunas,
    nomesNumericas,
    nomesTexto,
    traduzir: t,
    translateType,
    aoAlterarSelecaoColuna,
  });

  updateTabs(config.aba, aoAlterarConfigGraficos, config);

  const limite = Number(linhasPreview) > 0 ? Number(linhasPreview) : 10;
  document.getElementById('badge-linhas').textContent = t(
    'chive-badge-preview',
    dados.length.toLocaleString(getLocale()),
    Math.min(limite, dados.length),
    colunasVisiveis.length,
    colunas.length
  );

  renderTablePreview(dados, colunasVisiveis, limite);
  renderStats(dados, colunasVisiveis);
  renderCharts(config, dados, colunasVisiveis, colunasNumericasVisiveis);

  document.getElementById('btn-avancar').disabled = false;
  const avisoDev = document.getElementById('aviso-dev');
  if (avisoDev) avisoDev.style.display = 'block';
  document.getElementById('zona-upload').classList.add('carregado');
  document.querySelector('.upload-icone').textContent = '✓';
  document.querySelector('.upload-texto-principal').textContent = t('chive-upload-loaded-main');
  document.querySelector('.upload-texto-sub').textContent = t('chive-upload-loaded-sub');
  document.getElementById('arquivo-resumo-texto').title =
    `${nomeArquivo} · ${dados.length.toLocaleString(getLocale())} linhas · ${colunas.length} colunas · ${tamanhoArquivo}`;
}
