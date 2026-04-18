import { t, getLocale } from '../services/i18nService.js';
import { mergeChartConfigWithDefaults } from '../config/chartDefaults.js';
import { renderCharts } from '../features/chartFeatures/index.js';
import { getNumericColumns } from '../utils/columnHelpers.js';
import { translateType } from '../utils/formatters.js';

import { updateTabs } from './results/tabsView.js';
import { renderTablePreview } from './results/tablePreviewView.js';
import { renderStats } from './results/statsView.js';
import { renderFileListDOM } from './results/fileListView.js';
import { renderColumnControlsDOM } from './results/columnControlsView.js';
import { openJoinBuilderDialog } from './results/joinBuilderView.js';
import { openPresetDatasetsDialog } from './results/presetDatasetsView.js';

const FILE_LIST_PAGE_SIZE = 15;
let fileListQuery = '';
let fileListVisibleCount = FILE_LIST_PAGE_SIZE;

export function showErrorMessage(message) {
  const errorElement = document.getElementById('mensagem-erro');
  errorElement.textContent = '⚠ ' + message;
  errorElement.style.display = 'block';
}

export function hideErrorMessage() {
  document.getElementById('mensagem-erro').style.display = 'none';
}

export function renderFileList(datasets, activeIndex, onSelect, onRemove, onCreateJoin, onLoadPreset) {
  const fileInfo = document.getElementById('info-arquivo');
  const summary = document.getElementById('arquivo-resumo-texto');
  const list = document.getElementById('lista-arquivos-conteudo');

  fileInfo.style.display = 'block';
  const stickyHeaderId = 'arquivos-topo-fixo';
  let stickyHeader = document.getElementById(stickyHeaderId);
  if (!stickyHeader) {
    stickyHeader = document.createElement('div');
    stickyHeader.id = stickyHeaderId;
    stickyHeader.className = 'arquivos-topo-fixo';
    fileInfo.insertBefore(stickyHeader, summary);
  }

  if (summary.parentElement !== stickyHeader) {
    stickyHeader.appendChild(summary);
  }

  summary.textContent = t('chive-files-loaded', datasets.length);

  const activeDataset = activeIndex >= 0 && activeIndex < datasets.length ? datasets[activeIndex] : null;
  const selectedMetaId = 'arquivo-selecionado-meta';
  let selectedMeta = document.getElementById(selectedMetaId);
  if (!selectedMeta) {
    selectedMeta = document.createElement('div');
    selectedMeta.id = selectedMetaId;
    selectedMeta.className = 'arquivos-selecionado-meta';
    stickyHeader.appendChild(selectedMeta);
  } else if (selectedMeta.parentElement !== stickyHeader) {
    stickyHeader.appendChild(selectedMeta);
  }

  if (activeDataset) {
    const metaText = t(
      'chive-file-meta',
      activeDataset.dados.length.toLocaleString(getLocale()),
      activeDataset.colunas.length,
      activeDataset.tamanho
    );
    selectedMeta.textContent = `${activeDataset.nome} · ${metaText}`;
    selectedMeta.style.display = 'block';
    selectedMeta.title = selectedMeta.textContent;
  } else {
    selectedMeta.textContent = '';
    selectedMeta.style.display = 'none';
    selectedMeta.removeAttribute('title');
  }

  const toolsId = 'arquivos-ferramentas';
  let tools = document.getElementById(toolsId);
  if (!tools) {
    tools = document.createElement('div');
    tools.id = toolsId;
    tools.className = 'arquivos-ferramentas';
    stickyHeader.appendChild(tools);
  } else if (tools.parentElement !== stickyHeader) {
    stickyHeader.appendChild(tools);
  }

  tools.innerHTML = '';
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'arquivos-filtro-input';
  searchInput.id = 'arquivos-filtro-input';
  searchInput.placeholder = t('chive-files-search-placeholder');
  searchInput.value = fileListQuery;
  searchInput.setAttribute('aria-label', t('chive-files-search-placeholder'));
  tools.appendChild(searchInput);

  const filterStatus = document.createElement('div');
  filterStatus.className = 'arquivos-filtro-status';
  tools.appendChild(filterStatus);

  const paginationId = 'arquivos-paginacao';
  let pagination = document.getElementById(paginationId);
  if (!pagination) {
    pagination = document.createElement('div');
    pagination.id = paginationId;
    pagination.className = 'arquivos-paginacao';
    list.insertAdjacentElement('afterend', pagination);
  }

  const renderList = () => {
    const renderResult = renderFileListDOM({
      lista: list,
      datasets,
      indiceAtivo: activeIndex,
      traduzir: t,
      getLocale,
      aoSelecionar: onSelect,
      aoRemover: onRemove,
      filtro: fileListQuery,
      limiteVisivel: fileListVisibleCount,
    });

    filterStatus.textContent = t('chive-files-filter-status', renderResult.filtered, renderResult.total);
    pagination.innerHTML = '';

    if (renderResult.filtered > FILE_LIST_PAGE_SIZE) {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'btn-secundario arquivos-paginacao-btn';

      if (renderResult.hasMore) {
        toggle.textContent = t('chive-files-show-more', renderResult.filtered - renderResult.rendered);
        toggle.addEventListener('click', () => {
          fileListVisibleCount += FILE_LIST_PAGE_SIZE;
          renderList();
        });
      } else {
        toggle.textContent = t('chive-files-show-less');
        toggle.addEventListener('click', () => {
          fileListVisibleCount = FILE_LIST_PAGE_SIZE;
          renderList();
        });
      }

      pagination.appendChild(toggle);
    }
  };

  searchInput.addEventListener('input', () => {
    fileListQuery = searchInput.value;
    fileListVisibleCount = FILE_LIST_PAGE_SIZE;
    renderList();
  });

  fileListVisibleCount = Math.max(FILE_LIST_PAGE_SIZE, fileListVisibleCount);
  renderList();

  const joinActionsId = 'join-arquivos-acoes';
  let joinActions = document.getElementById(joinActionsId);
  if (!joinActions) {
    joinActions = document.createElement('div');
    joinActions.id = joinActionsId;
    joinActions.className = 'join-arquivos-acoes';
    list.insertAdjacentElement('afterend', joinActions);
  }

  joinActions.innerHTML = '';
  const joinButton = document.createElement('button');
  joinButton.type = 'button';
  joinButton.className = 'btn-secundario btn-join-files';
  joinButton.id = 'btn-join-files';
  joinButton.textContent = t('chive-btn-join-files');
  joinButton.disabled = datasets.length < 2;
  joinButton.addEventListener('click', async () => {
    const spec = await openJoinBuilderDialog({
      datasets,
      translate: t,
    });
    if (!spec) return;
    onCreateJoin?.(spec);
  });
  joinActions.appendChild(joinButton);

  const presetButton = document.createElement('button');
  presetButton.type = 'button';
  presetButton.className = 'btn-secundario btn-preset-datasets';
  presetButton.id = 'btn-preset-datasets';
  presetButton.textContent = t('chive-btn-preset-datasets');
  presetButton.addEventListener('click', async () => {
    const selected = await openPresetDatasetsDialog({ translate: t });
    if (!selected) return;
    onLoadPreset?.(selected);
  });
  joinActions.appendChild(presetButton);
}

export function renderEmptyState() {
  const els = {
    'info-arquivo': document.getElementById('info-arquivo'),
    'painel-colunas': document.getElementById('painel-colunas'),
    'estado-vazio': document.getElementById('estado-vazio'),
    'estado-dados': document.getElementById('estado-dados'),
    'resultado-tabs': document.getElementById('resultado-tabs'),
    'container-tabela': document.getElementById('container-tabela'),
    'container-stats': document.getElementById('container-stats'),
    'chart-bar-container': document.getElementById('chart-bar-container'),
    'chart-scatter-container': document.getElementById('chart-scatter-container'),
    'chart-network-container': document.getElementById('chart-network-container'),
    'chart-pie-container': document.getElementById('chart-pie-container'),
    'chart-bubble-container': document.getElementById('chart-bubble-container'),
    'badge-charts': document.getElementById('badge-charts'),
    'btn-avancar': document.getElementById('btn-avancar'),
  };

  // Only update elements that exist (not null)
  if (els['info-arquivo']) els['info-arquivo'].style.display = 'block';
  if (els['painel-colunas']) els['painel-colunas'].style.display = 'none';
  if (els['estado-vazio']) els['estado-vazio'].style.display = 'flex';
  if (els['estado-dados']) els['estado-dados'].style.display = 'none';
  if (els['resultado-tabs']) els['resultado-tabs'].style.display = 'none';
  if (els['container-tabela']) els['container-tabela'].innerHTML = '';
  if (els['container-stats']) els['container-stats'].innerHTML = '';
  if (els['chart-bar-container']) els['chart-bar-container'].innerHTML = '';
  if (els['chart-scatter-container']) els['chart-scatter-container'].innerHTML = '';
  if (els['chart-network-container']) els['chart-network-container'].innerHTML = '';
  if (els['chart-pie-container']) els['chart-pie-container'].innerHTML = '';
  if (els['chart-bubble-container']) els['chart-bubble-container'].innerHTML = '';
  if (els['badge-charts']) els['badge-charts'].textContent = '—';
  if (els['btn-avancar']) els['btn-avancar'].disabled = true;
  
  const devNotice = document.getElementById('aviso-dev');
  if (devNotice) devNotice.style.display = 'none';
  
  const zonaUpload = document.getElementById('zona-upload');
  if (zonaUpload) zonaUpload.classList.remove('carregado');
  
  const uploadIcone = document.querySelector('.upload-icone');
  if (uploadIcone) uploadIcone.textContent = '⬆';
  
  const uploadTextoMain = document.querySelector('.upload-texto-principal');
  if (uploadTextoMain) uploadTextoMain.textContent = t('chive-upload-main');
  
  const uploadTextoSub = document.querySelector('.upload-texto-sub');
  if (uploadTextoSub) uploadTextoSub.innerHTML = t('chive-upload-sub');
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
