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
  isAnyDialogOpen: vi.fn(() => false),
}));

vi.mock('../../src/services/i18nService.js', () => ({
  t: mocks.t,
}));

vi.mock('../../src/services/downloads/svg.js', () => ({
  downloadSvgFromContainer: mocks.downloadSvgFromContainer,
}));

vi.mock('../../src/services/downloads/bytes.js', () => ({
  downloadBytes: mocks.downloadBytes,
}));

vi.mock('../../src/services/persistence.js', () => ({
  PROJECT_FILE_MIME: 'application/vnd.chive.project+sqlite3',
  exportProject: mocks.exportProject,
  importProjectBytes: mocks.importProjectBytes,
  getProjectImportErrorMessageKey: mocks.getProjectImportErrorMessageKey,
}));

vi.mock('../../src/features/panel/panelController.js', () => ({
  addChartToPanel: mocks.addChartToPanel,
  setupPanelEventListeners: mocks.setupPanelEventListeners,
}));

vi.mock('../../src/ui/feedback.js', () => ({
  showError: mocks.showError,
  showFeedback: mocks.showFeedback,
  showProgress: mocks.showProgress,
}));

vi.mock('../../src/features/datasetWorkspace/datasetController.js', () => ({
  setupFileInputListeners: mocks.setupFileInputListeners,
  selectDataset: mocks.selectDataset,
  removeDatasetByIndex: mocks.removeDatasetByIndex,
}));

vi.mock('../../src/app/uiManager.js', () => ({
  setupTabListeners: mocks.setupTabListeners,
  setupSidebarToggleListener: mocks.setupSidebarToggleListener,
  switchTab: mocks.switchTab,
}));

vi.mock('../../src/state/appState.js', () => ({
  getActiveDataset: mocks.getActiveDataset,
  getPersistenceSnapshot: mocks.getPersistenceSnapshot,
  replaceAllState: mocks.replaceAllState,
  updateActiveDatasetConfig: mocks.updateActiveDatasetConfig,
}));

vi.mock('../../src/ui/dialogFocus.js', () => ({
  isAnyDialogOpen: mocks.isAnyDialogOpen,
}));

import {
  initializeDomBindings,
} from '../../src/app/domBindings.js';

function setupDom() {
  document.body.innerHTML = `
    <button id="btn-advance" type="button"></button>
    <button id="btn-edit-columns" type="button"></button>
    <button id="btn-go-to-panel" type="button"></button>
    <button id="btn-back-to-viz" type="button"></button>

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
    initializeDomBindings();

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
});
