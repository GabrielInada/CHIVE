// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getState: vi.fn(),
  getActiveDataset: vi.fn(),
  getAllDatasets: vi.fn(),
  onStateChange: vi.fn(),
  updateActiveDatasetConfig: vi.fn(),
  updateActiveDatasetColumns: vi.fn(),
  setSidebarMode: vi.fn(),
  exposeGlobals: vi.fn(),
}));

vi.mock('../src/modules/appState.js', () => ({
  getState: mocks.getState,
  getActiveDataset: mocks.getActiveDataset,
  getAllDatasets: mocks.getAllDatasets,
  onStateChange: mocks.onStateChange,
  STATE_EVENTS: { WILDCARD: '*' },
  updateActiveDatasetConfig: mocks.updateActiveDatasetConfig,
  updateActiveDatasetColumns: mocks.updateActiveDatasetColumns,
  setSidebarMode: mocks.setSidebarMode,
  exposeGlobals: mocks.exposeGlobals,
}));

import {
  debugLogState,
  getStateSummary,
  initializeStateSync,
  switchSidebarMode,
  syncWindowGlobals,
  updateActiveDatasetChartConfig,
  updateActiveDatasetColumnSelection,
} from '../src/modules/stateSync.js';

function buildState() {
  return {
    data: {
      datasets: [{ nome: 'A' }, { nome: 'B' }],
      activeIndex: 1,
    },
    panel: {
      charts: [{ id: 1 }, { id: 2 }, { id: 3 }],
      layout: 'layout-2col',
    },
    ui: {
      sidebarMode: 'viz',
      expandedCharts: { bar: true },
    },
  };
}

describe('stateSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = `
      <div id="sidebar-panel-dados" class="inativo"></div>
      <div id="sidebar-panel-viz" class="inativo"></div>
      <div id="sidebar-panel-panel" class="inativo"></div>
    `;

    mocks.getState.mockReturnValue(buildState());
    mocks.getActiveDataset.mockReturnValue({ nome: 'B' });
  });

  it('initializeStateSync registra listener global e sincroniza imediatamente', () => {
    let stateListener = null;
    mocks.onStateChange.mockImplementation((scope, callback) => {
      if (scope === '*') {
        stateListener = callback;
      }
    });

    initializeStateSync();

    expect(mocks.onStateChange).toHaveBeenCalledWith('*', expect.any(Function));
    expect(mocks.exposeGlobals).toHaveBeenCalledTimes(1);

    stateListener();
    expect(mocks.exposeGlobals).toHaveBeenCalledTimes(2);
  });

  it('encaminha updates de colunas e config para appState', () => {
    updateActiveDatasetColumnSelection(['a', 'b']);
    updateActiveDatasetChartConfig({ aba: 'charts' });

    expect(mocks.updateActiveDatasetColumns).toHaveBeenCalledWith(['a', 'b']);
    expect(mocks.updateActiveDatasetConfig).toHaveBeenCalledWith({ aba: 'charts' });
  });

  it('switchSidebarMode atualiza estado e classes de sidebar', () => {
    switchSidebarMode('panel');

    expect(mocks.setSidebarMode).toHaveBeenCalledWith('panel');
    expect(document.getElementById('sidebar-panel-panel').classList.contains('ativo')).toBe(true);
    expect(document.getElementById('sidebar-panel-viz').classList.contains('ativo')).toBe(false);

    switchSidebarMode('dados');
    expect(document.getElementById('sidebar-panel-dados').classList.contains('ativo')).toBe(true);
  });

  it('gera summary e debug payload com fallback de activeDatasetName', () => {
    const summary = getStateSummary();
    expect(summary).toEqual({
      datasetsCount: 2,
      activeDatasetIndex: 1,
      activeDatasetName: 'B',
      panelChartsCount: 3,
      panelLayout: 'layout-2col',
      sidebarMode: 'viz',
      expandedCharts: { bar: true },
    });

    mocks.getActiveDataset.mockReturnValue(undefined);
    const fallbackSummary = getStateSummary();
    expect(fallbackSummary.activeDatasetName).toBe('none');

    const debug = debugLogState();
    expect(debug.summary).toBeTruthy();
    expect(debug.state).toEqual(buildState());
  });

  it('syncWindowGlobals expande globals diretamente', () => {
    syncWindowGlobals();
    expect(mocks.exposeGlobals).toHaveBeenCalledTimes(1);
  });
});
