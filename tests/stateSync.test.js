// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getState: vi.fn(),
  getActiveDataset: vi.fn(),
  updateActiveDatasetConfig: vi.fn(),
  updateActiveDatasetColumns: vi.fn(),
  setSidebarMode: vi.fn(),
}));

vi.mock('../src/modules/state/appState.js', () => ({
  getState: mocks.getState,
  getActiveDataset: mocks.getActiveDataset,
  updateActiveDatasetConfig: mocks.updateActiveDatasetConfig,
  updateActiveDatasetColumns: mocks.updateActiveDatasetColumns,
  setSidebarMode: mocks.setSidebarMode,
}));

import {
  debugLogState,
  getStateSummary,
  switchSidebarMode,
  updateActiveDatasetChartConfig,
  updateActiveDatasetColumnSelection,
} from '../src/modules/state/stateSync.js';

function buildState() {
  return {
    data: {
      datasets: [{ name: 'A' }, { name: 'B' }],
      activeIndex: 1,
    },
    panel: {
      charts: [{ id: 1 }, { id: 2 }, { id: 3 }],
      layout: 'template-2col',
    },
    ui: {
      sidebarMode: 'viz',
    },
  };
}

describe('stateSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = `
      <div id="sidebar-panel-data" class="inactive"></div>
      <div id="sidebar-panel-viz" class="inactive"></div>
      <div id="sidebar-panel-dashboard" class="inactive"></div>
    `;

    mocks.getState.mockReturnValue(buildState());
    mocks.getActiveDataset.mockReturnValue({ name: 'B' });
  });

  it('forwards columns and config updates to appState', () => {
    updateActiveDatasetColumnSelection(['a', 'b']);
    updateActiveDatasetChartConfig({ activeTab: 'charts' });

    expect(mocks.updateActiveDatasetColumns).toHaveBeenCalledWith(['a', 'b']);
    expect(mocks.updateActiveDatasetConfig).toHaveBeenCalledWith({ activeTab: 'charts' });
  });

  it('switchSidebarMode updates state and sidebar classes', () => {
    switchSidebarMode('panel');

    expect(mocks.setSidebarMode).toHaveBeenCalledWith('panel');
    expect(document.getElementById('sidebar-panel-dashboard').classList.contains('active')).toBe(true);
    expect(document.getElementById('sidebar-panel-viz').classList.contains('active')).toBe(false);

    switchSidebarMode('data');
    expect(document.getElementById('sidebar-panel-data').classList.contains('active')).toBe(true);
  });

  it('generates summary and debug payload with activeDatasetName fallback', () => {
    const summary = getStateSummary();
    expect(summary).toEqual({
      datasetsCount: 2,
      activeDatasetIndex: 1,
      activeDatasetName: 'B',
      panelChartsCount: 3,
      panelLayout: 'template-2col',
      sidebarMode: 'viz',
    });

    mocks.getActiveDataset.mockReturnValue(undefined);
    const fallbackSummary = getStateSummary();
    expect(fallbackSummary.activeDatasetName).toBe('none');

    const debug = debugLogState();
    expect(debug.summary).toBeTruthy();
    expect(debug.state).toEqual(buildState());
  });
});
