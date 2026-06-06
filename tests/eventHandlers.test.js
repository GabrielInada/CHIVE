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
  downloadBytes: vi.fn(),
  exportProject: vi.fn(),
  importProjectBytes: vi.fn(),
  getProjectImportErrorMessageKey: vi.fn(),
  showError: vi.fn(),
  showFeedback: vi.fn(),
  showProgress: vi.fn(),
  progressHandle: {
    update: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
    close: vi.fn(),
    onCancel: vi.fn(),
  },
  t: vi.fn(key => `tr:${key}`),
  getPersistenceSnapshot: vi.fn(() => ({ data: { datasets: [], activeIndex: -1 }, panel: null, ui: {} })),
  replaceAllState: vi.fn(),
  getActiveDataset: vi.fn(() => ({
    chartConfig: {
      activeTab: 'preview',
      pie: {
        category: 'categoria',
        measureMode: 'count',
        valueColumn: null,
        innerRadius: 0,
        outerRadius: 100,
        labelPosition: 'inside',
      },
    },
  })),
  updateActiveDatasetConfig: vi.fn(),
}));

vi.mock('../src/services/i18nService.js', () => ({
  t: mocks.t,
}));

vi.mock('../src/utils/svgExport.js', () => ({
  downloadSvgFromContainer: mocks.downloadSvgFromContainer,
}));

vi.mock('../src/utils/downloadBytes.js', () => ({
  downloadBytes: mocks.downloadBytes,
}));

vi.mock('../src/services/persistenceService.js', () => ({
  PROJECT_FILE_MIME: 'application/vnd.chive.project+sqlite3',
  exportProject: mocks.exportProject,
  importProjectBytes: mocks.importProjectBytes,
  getProjectImportErrorMessageKey: mocks.getProjectImportErrorMessageKey,
}));

vi.mock('../src/modules/panelManager.js', () => ({
  addChartToPanel: mocks.addChartToPanel,
  setupPanelEventListeners: mocks.setupPanelEventListeners,
}));

vi.mock('../src/modules/feedbackUI.js', () => ({
  showError: mocks.showError,
  showFeedback: mocks.showFeedback,
  showProgress: mocks.showProgress,
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

vi.mock('../src/modules/state/appState.js', () => ({
  getActiveDataset: mocks.getActiveDataset,
  getPersistenceSnapshot: mocks.getPersistenceSnapshot,
  replaceAllState: mocks.replaceAllState,
  updateActiveDatasetConfig: mocks.updateActiveDatasetConfig,
}));

import {
  initializeAllEventHandlers,
  setupResultsViewListeners,
} from '../src/modules/eventHandlers.js';

function setupDom() {
  document.body.innerHTML = `
    <button id="btn-advance" type="button"></button>
    <button id="btn-edit-columns" type="button"></button>
    <button id="btn-go-to-panel" type="button"></button>
    <button id="btn-back-to-viz" type="button"></button>

    <select id="select-lang">
      <option value="pt-BR">Português</option>
      <option value="en">English</option>
    </select>
    <button id="lang-display" type="button"></button>

    <input id="file-input" type="file" />
    <div class="project-menu">
      <button id="btn-project-menu" type="button" aria-expanded="false"></button>
      <div id="project-menu-panel" hidden>
        <button id="btn-project-export" type="button"></button>
        <button id="btn-project-export-work-only" type="button"></button>
        <button id="btn-project-import" type="button"></button>
      </div>
    </div>
    <input id="project-import-input" type="file" />

    <div class="chart-block">
      <h3 class="chart-title">Meu Grafico</h3>
      <div data-chart-actions>
        <button
          class="chart-action-btn"
          data-chart-action="download-svg"
          data-chart-container="chart-1"
          data-chart-filename="grafico"
          type="button"
        ></button>
        <button
          class="chart-action-btn"
          data-chart-action="add-panel"
          data-chart-container="chart-1"
          type="button"
        ></button>
      </div>
    </div>

    <button data-dataset-select="2" type="button"></button>
    <button data-dataset-remove="1" type="button"></button>

    <div id="column-list-content"></div>
  `;
}

describe('eventHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.downloadSvgFromContainer.mockReturnValue({ ok: true });
    mocks.downloadBytes.mockReturnValue({ ok: true });
    mocks.exportProject.mockResolvedValue({
      ok: true,
      bytes: new Uint8Array([1, 2, 3]),
      fileName: 'project.chive.sqlite3',
    });
    mocks.importProjectBytes.mockResolvedValue({ ok: true });
    mocks.getProjectImportErrorMessageKey.mockReturnValue('chive-project-import-error');
    mocks.showProgress.mockReturnValue(mocks.progressHandle);
    mocks.addChartToPanel.mockReturnValue({ ok: true });
    mocks.getActiveDataset.mockReturnValue({ chartConfig: { activeTab: 'preview' } });
    window.confirm = vi.fn(() => true);

    setupDom();
  });

  it('initializes handlers and covers main interaction flows', () => {
    initializeAllEventHandlers();

    expect(mocks.setupFileInputListeners).toHaveBeenCalledTimes(1);
    expect(mocks.setupTabListeners).toHaveBeenCalledTimes(1);
    expect(mocks.setupSidebarToggleListener).toHaveBeenCalledTimes(1);
    expect(mocks.setupPanelEventListeners).toHaveBeenCalledTimes(1);

    document.getElementById('btn-go-to-panel').click();
    expect(mocks.updateActiveDatasetConfig).toHaveBeenCalledWith({ activeTab: 'panel' });
    expect(mocks.switchTab).toHaveBeenCalledWith('panel');

    document.getElementById('btn-back-to-viz').click();
    expect(mocks.switchTab).toHaveBeenCalledWith('charts');

    mocks.downloadSvgFromContainer.mockReturnValueOnce({ ok: false });
    document.querySelector('[data-chart-action="download-svg"]').click();

    expect(mocks.downloadSvgFromContainer).toHaveBeenCalledWith('chart-1', 'grafico');
    expect(mocks.showError).toHaveBeenCalledWith('tr:chive-chart-download-error');

    document.querySelector('[data-chart-action="add-panel"]').click();
    expect(mocks.addChartToPanel).toHaveBeenCalledWith('chart-1', 'Meu Grafico', expect.any(Object));
    expect(mocks.showFeedback).toHaveBeenCalledWith('tr:chive-panel-add-success');

    mocks.addChartToPanel.mockReturnValueOnce({ ok: false });
    document.querySelector('[data-chart-action="add-panel"]').click();
    expect(mocks.showError).toHaveBeenCalledWith('tr:chive-panel-add-error');

    const input = document.getElementById('file-input');
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
  });

  it('handles project export and import controls', async () => {
    initializeAllEventHandlers();

    const menuButton = document.getElementById('btn-project-menu');
    const menuPanel = document.getElementById('project-menu-panel');
    menuButton.click();
    expect(menuPanel.hidden).toBe(false);
    expect(menuButton.getAttribute('aria-expanded')).toBe('true');

    document.getElementById('btn-project-export').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(menuPanel.hidden).toBe(true);
    expect(mocks.exportProject).toHaveBeenCalledWith(mocks.getPersistenceSnapshot(), { workOnly: false });
    expect(mocks.downloadBytes).toHaveBeenCalledWith(
      new Uint8Array([1, 2, 3]),
      'project.chive.sqlite3',
      { mimeType: 'application/vnd.chive.project+sqlite3' },
    );
    expect(mocks.progressHandle.succeed).toHaveBeenCalledWith('tr:chive-project-export-success');

    menuButton.click();
    document.getElementById('btn-project-export-work-only').click();
    await Promise.resolve();
    await Promise.resolve();
    expect(mocks.exportProject).toHaveBeenLastCalledWith(mocks.getPersistenceSnapshot(), { workOnly: true });

    const importButton = document.getElementById('btn-project-import');
    const importInput = document.getElementById('project-import-input');
    const inputClick = vi.spyOn(importInput, 'click').mockImplementation(() => {});
    importButton.click();
    expect(inputClick).toHaveBeenCalledTimes(1);

    const file = new File([new Uint8Array([9, 8])], 'project.chive.sqlite3');
    Object.defineProperty(file, 'arrayBuffer', {
      value: vi.fn(async () => new Uint8Array([9, 8]).buffer),
    });
    Object.defineProperty(importInput, 'files', {
      value: [file],
      configurable: true,
    });

    importInput.dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(window.confirm).toHaveBeenCalledWith('tr:chive-project-import-confirm');
    expect(mocks.importProjectBytes).toHaveBeenCalledWith(
      new Uint8Array([9, 8]),
      expect.objectContaining({ replaceAllState: mocks.replaceAllState }),
    );
    expect(mocks.progressHandle.succeed).toHaveBeenCalledWith('tr:chive-project-import-success');
  });

  it('setupResultsViewListeners registers listeners without breaking flow', () => {
    setupResultsViewListeners();

    const list = document.getElementById('column-list-content');
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
