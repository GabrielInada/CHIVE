// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import {
  addChartSnapshot,
  assignChartToPanelBlockSlot,
  getChartSnapshot,
  getPanelBlocks,
  removeChartSnapshot,
  replaceAllState,
} from '../src/modules/appState.js';

function resetAppStateForTest() {
  replaceAllState({
    data: { datasets: [], activeIndex: -1 },
    panel: { charts: [], slots: {}, layout: 'layout-2col', blocks: [], nextBlockId: 1, nextChartId: 0 },
    ui: { sidebarMode: 'dados', previewRows: 10 },
  });
}

describe('appState panel chart IDs', () => {
  beforeEach(() => {
    resetAppStateForTest();
  });

  it('stores first chart with id 0 and resolves string id lookups', () => {
    const id = addChartSnapshot({ nome: 'Chart A', svgMarkup: '<svg />' });

    expect(id).toBe(0);
    expect(getChartSnapshot(0)?.nome).toBe('Chart A');
    expect(getChartSnapshot('0')?.nome).toBe('Chart A');
  });

  it('assigns string chart IDs to block slots with normalization', () => {
    addChartSnapshot({ nome: 'Chart A', svgMarkup: '<svg />' });
    const block = getPanelBlocks()[0];

    assignChartToPanelBlockSlot(block.id, 'slot-1', '0');

    expect(getPanelBlocks()[0].slots['slot-1']).toBe(0);
  });

  it('clears block slot assignment when chart is removed', () => {
    const id = addChartSnapshot({ nome: 'Chart A', svgMarkup: '<svg />' });
    const block = getPanelBlocks()[0];
    assignChartToPanelBlockSlot(block.id, 'slot-1', id);

    removeChartSnapshot(id);

    expect(getPanelBlocks()[0].slots['slot-1']).toBeUndefined();
    expect(getChartSnapshot(id)).toBeNull();
  });
});
