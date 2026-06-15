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

vi.mock('../src/modules/dialogFocus.js', () => ({
  isAnyDialogOpen: mocks.isAnyDialogOpen,
}));

import {
  initializeAllEventHandlers,
} from '../src/modules/eventHandlers.js';
import { CHART_CONTAINERS } from '../src/config/elementIds.js';

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

const flushPromises = async (count = 4) => {
  for (let i = 0; i < count; i += 1) await Promise.resolve();
};

function makeProjectFile(bytes = [9, 8]) {
  const file = new File([new Uint8Array(bytes)], 'project.chive.sqlite3');
  Object.defineProperty(file, 'arrayBuffer', {
    value: vi.fn(async () => new Uint8Array(bytes).buffer),
  });
  return file;
}

function setInputFiles(input, files) {
  Object.defineProperty(input, 'files', {
    value: files,
    configurable: true,
  });
}

function appendChartAction({ type, action = 'add-panel', title = 'Rendered Title', filename = '' }) {
  const containerId = CHART_CONTAINERS[type] || 'unknown-container';
  const block = document.createElement('div');
  block.className = 'chart-block';
  block.innerHTML = `
    <h3 class="chart-title">${title}</h3>
    <button
      data-chart-action="${action}"
      data-chart-container="${containerId}"
      ${filename ? `data-chart-filename="${filename}"` : ''}
      type="button"
    ></button>
  `;
  document.body.appendChild(block);
  return block.querySelector('button');
}

function fullChartConfig(overrides = {}) {
  return {
    activeTab: 'charts',
    bar: { category: 'species', customTitle: '', ...overrides.bar },
    scatter: { x: 'width', y: 'height', customTitle: '', ...overrides.scatter },
    pie: {
      category: 'family',
      measureMode: 'count',
      valueColumn: '',
      innerRadius: 10,
      outerRadius: 90,
      padAngle: 2,
      labelPosition: 'inside',
      customTitle: '',
      ...overrides.pie,
    },
    bubble: {
      category: 'family',
      measureMode: 'count',
      valueColumn: '',
      groupColumn: '',
      topN: 0,
      customTitle: '',
      ...overrides.bubble,
    },
    network: { source: 'from', target: 'to', weight: 'count', customTitle: '', ...overrides.network },
    treemap: {
      category: 'family',
      measureMode: 'count',
      valueColumn: '',
      topN: 8,
      customTitle: '',
      ...overrides.treemap,
    },
    line: { x: 'date', y: 'visits', curve: 'monotone', customTitle: '', ...overrides.line },
    tin: { x: 'x', y: 'y', z: 'elevation', customTitle: '', ...overrides.tin },
  };
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

  it('Ctrl/Cmd+O opens the file picker and prevents default when no dialog is open', () => {
    mocks.isAnyDialogOpen.mockReturnValue(false);
    initializeAllEventHandlers();
    const clickSpy = vi.spyOn(document.getElementById('file-input'), 'click');

    const event = new KeyboardEvent('keydown', { key: 'o', ctrlKey: true, bubbles: true, cancelable: true });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('Ctrl/Cmd+O does not open the file picker behind an open modal dialog', () => {
    mocks.isAnyDialogOpen.mockReturnValue(true);
    initializeAllEventHandlers();
    const clickSpy = vi.spyOn(document.getElementById('file-input'), 'click');

    const event = new KeyboardEvent('keydown', { key: 'o', metaKey: true, bubbles: true, cancelable: true });
    document.dispatchEvent(event);

    // Default is still prevented so the browser's native open dialog never shows.
    expect(event.defaultPrevented).toBe(true);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('skips global shortcuts when the event was already defaultPrevented', () => {
    mocks.isAnyDialogOpen.mockReturnValue(false);
    initializeAllEventHandlers();
    const clickSpy = vi.spyOn(document.getElementById('file-input'), 'click');

    const event = new KeyboardEvent('keydown', { key: 'o', ctrlKey: true, bubbles: true, cancelable: true });
    event.preventDefault();
    document.dispatchEvent(event);

    expect(clickSpy).not.toHaveBeenCalled();
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

    const file = makeProjectFile();
    setInputFiles(importInput, [file]);

    importInput.dispatchEvent(new Event('change', { bubbles: true }));
    await flushPromises();

    expect(window.confirm).toHaveBeenCalledWith('tr:chive-project-import-confirm');
    expect(mocks.importProjectBytes).toHaveBeenCalledWith(
      new Uint8Array([9, 8]),
      expect.objectContaining({ replaceAllState: mocks.replaceAllState }),
    );
    expect(mocks.progressHandle.succeed).toHaveBeenCalledWith('tr:chive-project-import-success');
  });

  it('closes the project menu on outside click and Escape, while ignoring inside clicks', () => {
    initializeAllEventHandlers();

    const menuButton = document.getElementById('btn-project-menu');
    const menuPanel = document.getElementById('project-menu-panel');

    menuButton.click();
    expect(menuPanel.hidden).toBe(false);

    document.querySelector('.project-menu').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(menuPanel.hidden).toBe(false);

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(menuPanel.hidden).toBe(true);

    menuButton.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(menuPanel.hidden).toBe(true);
  });

  it('tolerates missing project menu/input elements while wiring available controls', async () => {
    setupDom();
    document.getElementById('btn-project-menu').remove();
    document.getElementById('project-menu-panel').remove();
    document.getElementById('project-import-input').remove();
    document.body.insertAdjacentHTML('beforeend', `
      <button id="btn-project-export" type="button"></button>
      <button id="btn-project-import" type="button"></button>
    `);

    initializeAllEventHandlers();

    expect(() => document.getElementById('btn-project-export').click()).not.toThrow();
    await flushPromises();
    expect(mocks.exportProject).toHaveBeenCalled();
    expect(() => document.getElementById('btn-project-import').click()).not.toThrow();
  });

  it('covers project export failure, download failure, thrown export, and busy reentry', async () => {
    initializeAllEventHandlers();
    const exportButton = document.getElementById('btn-project-export');

    mocks.exportProject.mockResolvedValueOnce({ ok: false });
    exportButton.click();
    await flushPromises();
    expect(mocks.progressHandle.fail).toHaveBeenCalledWith('tr:chive-project-export-error');

    mocks.exportProject.mockResolvedValueOnce({
      ok: true,
      bytes: new Uint8Array([1]),
      fileName: 'project.chive.sqlite3',
    });
    mocks.downloadBytes.mockReturnValueOnce({ ok: false });
    exportButton.click();
    await flushPromises();
    expect(mocks.progressHandle.fail).toHaveBeenCalledWith('tr:chive-project-export-error');

    mocks.exportProject.mockRejectedValueOnce(new Error('boom'));
    exportButton.click();
    await flushPromises();
    expect(mocks.progressHandle.fail).toHaveBeenCalledWith('tr:chive-project-export-error');

    let releaseExport;
    mocks.exportProject.mockImplementationOnce(() => new Promise(resolve => {
      releaseExport = () => resolve({
        ok: true,
        bytes: new Uint8Array([2]),
        fileName: 'slow.chive.sqlite3',
      });
    }));
    exportButton.click();
    exportButton.click();
    expect(mocks.showProgress).toHaveBeenCalledWith('tr:chive-project-exporting');
    expect(mocks.exportProject).toHaveBeenCalledTimes(4);
    releaseExport();
    await flushPromises();
  });

  it('covers project import no-file, cancel, failed import, and thrown file reads', async () => {
    initializeAllEventHandlers();
    const importInput = document.getElementById('project-import-input');

    setInputFiles(importInput, []);
    importInput.dispatchEvent(new Event('change', { bubbles: true }));
    await flushPromises();
    expect(mocks.importProjectBytes).not.toHaveBeenCalled();

    window.confirm = vi.fn(() => false);
    setInputFiles(importInput, [makeProjectFile([1])]);
    importInput.dispatchEvent(new Event('change', { bubbles: true }));
    await flushPromises();
    expect(mocks.importProjectBytes).not.toHaveBeenCalled();

    window.confirm = vi.fn(() => true);
    mocks.importProjectBytes.mockResolvedValueOnce({ ok: false, error: new Error('bad project') });
    setInputFiles(importInput, [makeProjectFile([2])]);
    importInput.dispatchEvent(new Event('change', { bubbles: true }));
    await flushPromises();
    expect(mocks.progressHandle.fail).toHaveBeenCalledWith('tr:chive-project-import-error');

    const badFile = makeProjectFile([3]);
    badFile.arrayBuffer.mockRejectedValueOnce(new Error('read failed'));
    setInputFiles(importInput, [badFile]);
    importInput.dispatchEvent(new Event('change', { bubbles: true }));
    await flushPromises();
    expect(mocks.progressHandle.fail).toHaveBeenCalledWith('tr:chive-project-import-error');
  });

  it('covers navigation branches without active chart config', () => {
    mocks.getActiveDataset.mockReturnValueOnce(null);
    initializeAllEventHandlers();

    document.getElementById('btn-advance').click();
    expect(mocks.updateActiveDatasetConfig).not.toHaveBeenCalledWith({ activeTab: 'charts' });
    expect(mocks.switchTab).toHaveBeenCalledWith('charts');

    mocks.getActiveDataset.mockReturnValueOnce({});
    document.getElementById('btn-edit-columns').click();
    expect(mocks.switchTab).toHaveBeenCalledWith('preview');
  });

  it('covers chart download success, default filename, ignored action, and missing targets', () => {
    initializeAllEventHandlers();

    const downloadButton = appendChartAction({ type: 'bar', action: 'download-svg' });
    downloadButton.click();
    expect(mocks.downloadSvgFromContainer).toHaveBeenLastCalledWith(CHART_CONTAINERS.bar, 'chart');
    expect(mocks.showError).not.toHaveBeenCalledWith('tr:chive-chart-download-error');

    const ignored = appendChartAction({ type: 'bar', action: 'unknown-action' });
    ignored.click();
    expect(mocks.addChartToPanel).not.toHaveBeenCalledWith(CHART_CONTAINERS.bar, expect.anything(), expect.anything());

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(() => initializeAllEventHandlers()).not.toThrow();
  });

  it.each([
    ['bar', {}, { summary: 'tr:chive-chart-control-bar-category: species' }],
    ['scatter', {}, { summary: 'X: width · Y: height' }],
    ['pie', {}, { measureMode: 'count', valueColumn: null, padAngle: 2 }],
    ['pie', { pie: { measureMode: 'sum', valueColumn: 'biomass', padAngle: '3' } }, { measureMode: 'sum', valueColumn: 'biomass', padAngle: 3 }],
    ['bubble', {}, { measureMode: 'count', valueColumn: null, groupColumn: null, topN: 0 }],
    ['bubble', { bubble: { measureMode: 'sum', valueColumn: 'biomass', groupColumn: 'family', topN: 12 } }, { measureMode: 'sum', valueColumn: 'biomass', groupColumn: 'family', topN: 12 }],
    ['bubble', { bubble: { measureMode: 'mean', valueColumn: 'biomass', topN: 0 } }, { measureMode: 'mean', valueColumn: 'biomass', topN: 0 }],
    ['network', {}, { source: 'from', target: 'to', weight: 'count' }],
    ['treemap', {}, { measureMode: 'count', valueColumn: null, topN: 8 }],
    ['treemap', { treemap: { measureMode: 'sum', valueColumn: 'biomass' } }, { measureMode: 'sum', valueColumn: 'biomass' }],
    ['line', {}, { x: 'date', y: 'visits', curve: 'monotone' }],
    ['tin', {}, { x: 'x', y: 'y', z: 'elevation' }],
  ])('builds add-panel snapshot metadata for %s charts', (type, overrides, expected) => {
    initializeAllEventHandlers();
    mocks.getActiveDataset.mockReturnValue({
      chartConfig: fullChartConfig(overrides),
    });

    const button = appendChartAction({ type, action: 'add-panel', title: `${type} title` });
    button.click();

    const [containerId, title, metadata] = mocks.addChartToPanel.mock.calls.at(-1);
    expect(containerId).toBe(CHART_CONTAINERS[type]);
    expect(title).toBe(`${type} title`);
    expect(metadata).toEqual(expect.objectContaining({ type, ...expected }));
    expect(mocks.showFeedback).toHaveBeenCalledWith('tr:chive-panel-add-success');
  });

  it('uses custom chart titles, generic fallback titles, and empty metadata for unresolved chart types', () => {
    initializeAllEventHandlers();
    mocks.getActiveDataset.mockReturnValue({
      chartConfig: fullChartConfig({ bar: { customTitle: 'Custom Bar' } }),
    });

    appendChartAction({ type: 'bar', action: 'add-panel', title: 'Fallback Bar' }).click();
    expect(mocks.addChartToPanel.mock.calls.at(-1)[1]).toBe('Custom Bar');

    const unknownButton = appendChartAction({ type: 'unknown', action: 'add-panel', title: '' });
    unknownButton.closest('.chart-block').querySelector('.chart-title').remove();
    unknownButton.click();
    expect(mocks.addChartToPanel.mock.calls.at(-1)).toEqual([
      'unknown-container',
      'tr:chive-card-charts',
      {},
    ]);

    mocks.getActiveDataset.mockReturnValue(null);
    appendChartAction({ type: 'bar', action: 'add-panel', title: 'No Dataset' }).click();
    expect(mocks.addChartToPanel.mock.calls.at(-1)[2]).toEqual({});
  });
});
