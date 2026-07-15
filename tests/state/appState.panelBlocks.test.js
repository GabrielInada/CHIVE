// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import * as appState from '../../src/state/appState.js';

function resetAppStateForTest() {
  appState.replaceAllState({
    data: { datasets: [], activeIndex: -1 },
    panel: { charts: [], slots: {}, layout: 'template-2col', blocks: [], nextBlockId: 1, nextChartId: 0 },
    ui: { sidebarMode: 'data', previewRows: 10 },
  });
}

describe('panel blocks state model', () => {
  beforeEach(() => {
    resetAppStateForTest();
  });

  it('exposes panel block management APIs', () => {
    expect(typeof appState.addPanelBlock).toBe('function');
    expect(typeof appState.removePanelBlock).toBe('function');
    expect(typeof appState.movePanelBlock).toBe('function');
    expect(typeof appState.updatePanelBlockProportions).toBe('function');
    expect(typeof appState.assignChartToPanelBlockSlot).toBe('function');
    expect(typeof appState.updatePanelBlockBorder).toBe('function');
  });

  it('initializes panel.blocks with one default template-2col block', () => {
    const state = appState.getState();

    expect(Array.isArray(state.panel.blocks)).toBe(true);
    expect(state.panel.blocks.length).toBe(1);
    expect(state.panel.blocks[0].templateId).toBe('template-2col');
    expect(state.panel.blocks[0].borderEnabled).toBe(false);
    expect(state.panel.blocks[0].borderColor).toBe('#5d645d');
  });

  it('stores border settings per block independently', () => {
    const blockA = appState.getState().panel.blocks[0].id;
    const blockB = appState.addPanelBlock('template-single');

    appState.updatePanelBlockBorder(blockA, { enabled: true, color: '#ff0000' });

    const state = appState.getState();
    const a = state.panel.blocks.find(b => b.id === blockA);
    const b = state.panel.blocks.find(bk => bk.id === blockB);

    expect(a.borderEnabled).toBe(true);
    expect(a.borderColor).toBe('#ff0000');
    expect(b.borderEnabled).toBe(false);
    expect(b.borderColor).toBe('#5d645d');
  });

  it('caps panel blocks at 4', () => {
    appState.addPanelBlock('template-single');
    appState.addPanelBlock('template-3col');
    appState.addPanelBlock('template-1x2');
    appState.addPanelBlock('template-hero2');

    const state = appState.getState();
    expect(state.panel.blocks.length).toBe(4);
  });

  it('stores proportions in percentages and enforces min constraints', () => {
    const blockId = appState.addPanelBlock('template-2col');

    appState.updatePanelBlockProportions(blockId, {
      split: 5,
    });

    const state = appState.getState();
    const block = state.panel.blocks.find(b => b.id === blockId);

    expect(block.proportions.split).toBeGreaterThanOrEqual(20);
    expect(block.proportions.split).toBeLessThanOrEqual(80);
  });

  it('keeps slot assignment scoped to block id + slot id', () => {
    const chartId = appState.addChartSnapshot({ name: 'Chart A', svgMarkup: '<svg />' });
    const blockA = appState.addPanelBlock('template-2col');
    const blockB = appState.addPanelBlock('template-2col');

    appState.assignChartToPanelBlockSlot(blockA, 'slot-1', chartId);

    const state = appState.getState();
    const a = state.panel.blocks.find(b => b.id === blockA);
    const b = state.panel.blocks.find(bk => bk.id === blockB);

    expect(a.slots['slot-1']).toBe(chartId);
    expect(b.slots['slot-1']).toBeUndefined();
  });
});
