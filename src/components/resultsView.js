import { t, getLocale } from '../services/i18nService.js';
import { mergeChartConfigWithDefaults } from '../config/chartDefaults.js';
import { renderCharts } from '../features/chartFeatures/index.js';
import { getNumericColumns } from '../utils/columnHelpers.js';

import { updateTabs } from './results/tabsView.js';
import { renderTablePreview } from './results/tablePreviewView.js';
import { renderStats } from './results/statsView.js';
import { renderFileListDOM } from './results/fileListView.js';
import { renderColumnControlsDOM } from './results/columnControlsView.js';

function translateType(type) {
  if (type === 'numero') return t('chive-type-number');
  if (type === 'texto') return t('chive-type-text');
  return type;
}

export function showErrorMessage(message) {
  const errorElement = document.getElementById('mensagem-erro');
  errorElement.textContent = '⚠ ' + message;
  errorElement.style.display = 'block';
}

export function hideErrorMessage() {
  document.getElementById('mensagem-erro').style.display = 'none';
}

export function renderFileList(datasets, activeIndex, onSelect, onRemove) {
  const fileInfo = document.getElementById('info-arquivo');
  const summary = document.getElementById('arquivo-resumo-texto');
  const list = document.getElementById('lista-arquivos-conteudo');

  fileInfo.style.display = 'block';
  summary.textContent = t('chive-files-loaded', datasets.length);

  renderFileListDOM({
    lista: list,
    datasets,
    indiceAtivo: activeIndex,
    traduzir: t,
    getLocale,
    aoSelecionar: onSelect,
    aoRemover: onRemove,
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
  const devNotice = document.getElementById('aviso-dev');
  if (devNotice) devNotice.style.display = 'none';
  document.getElementById('zona-upload').classList.remove('carregado');
  document.querySelector('.upload-icone').textContent = '⬆';
  document.querySelector('.upload-texto-principal').textContent = t('chive-upload-main');
  document.querySelector('.upload-texto-sub').innerHTML = t('chive-upload-sub');
}

export function renderDataInterface(
  rows,
  columns,
  fileName,
  fileSize,
  previewRows = 10,
  onPreviewRowsChange = null,
  selectedColumns = null,
  onColumnSelectionChange = null,
  chartConfig = null,
  onChartConfigChange = null
) {
  document.getElementById('painel-colunas').style.display = 'block';
  document.getElementById('resultado-tabs').style.display = 'flex';
  document.getElementById('estado-vazio').style.display = 'none';
  document.getElementById('estado-dados').style.display = 'flex';

  const columnNames = columns.map(column => column.nome);
  const selectedNames = new Set(Array.isArray(selectedColumns) ? selectedColumns : columnNames);
  const visibleColumns = columns.filter(column => selectedNames.has(column.nome));
  const visibleNumericColumns = getNumericColumns(visibleColumns);

  const config = mergeChartConfigWithDefaults(chartConfig);

  // Detecta filtro ativo
  const numericNames = columns.filter(c => c.tipo === 'numero').map(c => c.nome);
  const textNames = columns.filter(c => c.tipo === 'texto').map(c => c.nome);
  const selectedArray = [...selectedNames];
  const activeFilter =
    selectedArray.length === columnNames.length ? 'todas'
      : selectedArray.length === numericNames.length && selectedArray.every(n => numericNames.includes(n)) ? 'numericas'
        : selectedArray.length === textNames.length && selectedArray.every(n => textNames.includes(n)) ? 'texto'
          : null;

  // Renderiza botões fora do scroll
  const actionsContainer = document.getElementById('colunas-acoes');
  const columnsList = document.getElementById('lista-colunas-conteudo');

  renderColumnControlsDOM({
    acoesContainer: actionsContainer,
    listaColunas: columnsList,
    colunas: columns,
    nomesSelecionados: selectedNames,
    filtroAtivo: activeFilter,
    nomesColunas: columnNames,
    nomesNumericas: numericNames,
    nomesTexto: textNames,
    traduzir: t,
    translateType,
    aoAlterarSelecaoColuna: onColumnSelectionChange,
  });

  updateTabs(config.aba, onChartConfigChange, config);

  const rowLimit = Number(previewRows) > 0 ? Number(previewRows) : 10;
  const rowSelector = document.getElementById('select-linhas-preview');
  if (rowSelector) {
    rowSelector.value = String(rowLimit);
    rowSelector.onchange = event => {
      if (!onPreviewRowsChange) return;
      const nextRows = Number(event.target.value);
      if (!Number.isFinite(nextRows) || nextRows < 1) return;
      onPreviewRowsChange(nextRows);
    };
  }
  document.getElementById('badge-linhas').textContent = t(
    'chive-badge-preview',
    rows.length.toLocaleString(getLocale()),
    Math.min(rowLimit, rows.length),
    visibleColumns.length,
    columns.length
  );

  renderTablePreview(rows, visibleColumns, rowLimit);
  renderStats(rows, visibleColumns);
  renderCharts(config, rows, visibleColumns, visibleNumericColumns);

  document.getElementById('btn-avancar').disabled = false;
  const devNotice = document.getElementById('aviso-dev');
  if (devNotice) devNotice.style.display = 'block';
  document.getElementById('zona-upload').classList.add('carregado');
  document.querySelector('.upload-icone').textContent = '✓';
  document.querySelector('.upload-texto-principal').textContent = t('chive-upload-loaded-main');
  document.querySelector('.upload-texto-sub').textContent = t('chive-upload-loaded-sub');
  document.getElementById('arquivo-resumo-texto').title =
    `${fileName} · ${rows.length.toLocaleString(getLocale())} linhas · ${columns.length} colunas · ${fileSize}`;
}
