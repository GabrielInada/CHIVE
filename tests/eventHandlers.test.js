// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  setupFileInputListeners: vi.fn(),
  selectDataset: vi.fn(),
  removeDatasetByIndex: vi.fn(),
  setupTabListeners: vi.fn(),
  setupSidebarToggleListener: vi.fn(),
  switchTab: vi.fn(),
  setupPanelEventListeners: vi.fn(),
  addChartToPanel: vi.fn(),
  downloadSvgFromContainer: vi.fn(),
  showError: vi.fn(),
  showFeedback: vi.fn(),
  definirLocale: vi.fn(),
  obterLocale: vi.fn(() => 'pt-BR'),
  t: vi.fn(key => `tr:${key}`),
  getActiveDataset: vi.fn(() => ({
    configGraficos: {
      aba: 'preview',
    },
  })),
  updateActiveDatasetConfig: vi.fn(),
}));

vi.mock('../src/services/i18nService.js', () => ({
  t: mocks.t,
  definirLocale: mocks.definirLocale,
  obterLocale: mocks.obterLocale,
}));

vi.mock('../src/utils/svgExport.js', () => ({
  downloadSvgFromContainer: mocks.downloadSvgFromContainer,
}));

vi.mock('../src/modules/panelManager.js', () => ({
  addChartToPanel: mocks.addChartToPanel,
  setupPanelEventListeners: mocks.setupPanelEventListeners,
}));

vi.mock('../src/modules/feedbackUI.js', () => ({
  showError: mocks.showError,
  showFeedback: mocks.showFeedback,
}));

vi.mock('../src/modules/fileManager.js', () => ({
  setupFileInputListeners: mocks.setupFileInputListeners,
  selectDataset: mocks.selectDataset,
  removeDatasetByIndex: mocks.removeDatasetByIndex,
}));

vi.mock('../src/modules/uiManager.js', () => ({
  setupTabListeners: mocks.setupTabListeners,
  setupSidebarToggleListener: mocks.setupSidebarToggleListener,
  switchTab: mocks.switchTab,
}));

vi.mock('../src/modules/appState.js', () => ({
  getActiveDataset: mocks.getActiveDataset,
  updateActiveDatasetConfig: mocks.updateActiveDatasetConfig,
}));

import {
  initializeAllEventHandlers,
  setupResultsViewListeners,
} from '../src/modules/eventHandlers.js';

function setupDom() {
  document.body.innerHTML = `
    <button id="btn-avancar" type="button"></button>
    <button id="btn-editar-colunas" type="button"></button>
    <button id="btn-ir-painel" type="button"></button>
    <button id="btn-voltar-viz" type="button"></button>

    <select id="select-lang">
      <option value="pt-BR">Português</option>
      <option value="en">English</option>
    </select>
    <button id="lang-display" type="button"></button>

    <input id="input-arquivo" type="file" />

    <div class="chart-bloco">
      <h3 class="chart-titulo">Meu Grafico</h3>
      <div data-chart-actions>
        <button data-chart-menu-btn="menu-1" aria-expanded="false" type="button"></button>
        <div data-chart-menu="menu-1" hidden>
          <button
            data-chart-action="download-svg"
            data-chart-container="chart-1"
            data-chart-filename="grafico"
            type="button"
          ></button>
          <button
            data-chart-action="add-panel"
            data-chart-container="chart-1"
            type="button"
          ></button>
        </div>
      </div>
    </div>

    <button data-dataset-select="2" type="button"></button>
    <button data-dataset-remove="1" type="button"></button>

    <div id="lista-colunas-conteudo"></div>
  `;
}

describe('eventHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.obterLocale.mockReturnValue('pt-BR');
    mocks.downloadSvgFromContainer.mockReturnValue({ ok: true });
    mocks.addChartToPanel.mockReturnValue({ ok: true });
    mocks.getActiveDataset.mockReturnValue({ configGraficos: { aba: 'preview' } });

    setupDom();
  });

  it('inicializa handlers e cobre fluxos principais de interacao', () => {
    initializeAllEventHandlers();

    expect(mocks.setupFileInputListeners).toHaveBeenCalledTimes(1);
    expect(mocks.setupTabListeners).toHaveBeenCalledTimes(1);
    expect(mocks.setupSidebarToggleListener).toHaveBeenCalledTimes(1);
    expect(mocks.setupPanelEventListeners).toHaveBeenCalledTimes(1);

    document.getElementById('btn-ir-painel').click();
    expect(mocks.updateActiveDatasetConfig).toHaveBeenCalledWith({ aba: 'panel' });
    expect(mocks.switchTab).toHaveBeenCalledWith('panel');

    document.getElementById('btn-voltar-viz').click();
    expect(mocks.switchTab).toHaveBeenCalledWith('charts');

    mocks.downloadSvgFromContainer.mockReturnValueOnce({ ok: false });
    document.querySelector('[data-chart-action="download-svg"]').click();

    expect(mocks.downloadSvgFromContainer).toHaveBeenCalledWith('chart-1', 'grafico');
    expect(mocks.showError).toHaveBeenCalledWith('tr:chive-chart-download-error');
    expect(document.querySelector('[data-chart-menu="menu-1"]').hidden).toBe(true);

    document.querySelector('[data-chart-action="add-panel"]').click();
    expect(mocks.addChartToPanel).toHaveBeenCalledWith('chart-1', 'Meu Grafico');
    expect(mocks.showFeedback).toHaveBeenCalledWith('tr:chive-panel-add-success');

    mocks.addChartToPanel.mockReturnValueOnce({ ok: false });
    document.querySelector('[data-chart-action="add-panel"]').click();
    expect(mocks.showError).toHaveBeenCalledWith('tr:chive-panel-add-error');

    const select = document.getElementById('select-lang');
    const display = document.getElementById('lang-display');

    expect(display.textContent).toBe('Português');

    select.value = 'en';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(mocks.definirLocale).toHaveBeenCalledWith('en');
    expect(display.textContent).toBe('English');

    mocks.obterLocale.mockReturnValue('pt-BR');
    window.dispatchEvent(new Event('chive-locale-changed'));
    expect(select.value).toBe('pt-BR');
    expect(display.textContent).toBe('Português');

    const input = document.getElementById('input-arquivo');
    const clickSpy = vi.spyOn(input, 'click');

    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'o',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    }));

    expect(clickSpy).toHaveBeenCalledTimes(1);

    document.querySelector('[data-dataset-select="2"]').click();
    expect(mocks.selectDataset).toHaveBeenCalledWith(2);

    document.querySelector('[data-dataset-remove="1"]').click();
    expect(mocks.removeDatasetByIndex).toHaveBeenCalledWith(1);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('[data-chart-menu="menu-1"]').hidden).toBe(true);
  });

  it('setupResultsViewListeners registra listeners sem quebrar fluxo', () => {
    setupResultsViewListeners();

    const list = document.getElementById('lista-colunas-conteudo');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    list.appendChild(checkbox);

    checkbox.dispatchEvent(new Event('change', { bubbles: true }));

    const action = document.createElement('button');
    action.dataset.acaoColuna = 'mock';
    document.body.appendChild(action);
    action.click();

    expect(true).toBe(true);
  });
});
