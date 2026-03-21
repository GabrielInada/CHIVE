// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import * as appState from '../src/modules/appState.js';

describe('panel blocks state model (phase 1)', () => {
  beforeEach(() => {
    appState.resetState();
  });

  it('exposes panel block management APIs', () => {
    expect(typeof appState.addPanelBlock).toBe('function');
    expect(typeof appState.removePanelBlock).toBe('function');
    expect(typeof appState.movePanelBlock).toBe('function');
    expect(typeof appState.updatePanelBlockProportions).toBe('function');
    expect(typeof appState.assignChartToPanelBlockSlot).toBe('function');
  });

  it('initializes panel.blocks with one default layout-2col block', () => {
    const state = appState.getState();

    expect(Array.isArray(state.panel.blocks)).toBe(true);
    expect(state.panel.blocks.length).toBe(1);
    expect(state.panel.blocks[0].templateId).toBe('layout-2col');
  });

  it('caps panel blocks at 4', () => {
    appState.addPanelBlock('layout-single');
    appState.addPanelBlock('layout-3col');
    appState.addPanelBlock('layout-1x2');
    appState.addPanelBlock('layout-hero2');

    const state = appState.getState();
    expect(state.panel.blocks.length).toBe(4);
  });

  it('stores proportions in percentages and enforces min constraints', () => {
    const blockId = appState.addPanelBlock('layout-2col');

    appState.updatePanelBlockProportions(blockId, {
      split: 5,
    });

    const state = appState.getState();
    const block = state.panel.blocks.find(b => b.id === blockId);

    expect(block.proportions.split).toBeGreaterThanOrEqual(20);
    expect(block.proportions.split).toBeLessThanOrEqual(80);
  });

  it('keeps slot assignment scoped to block id + slot id', () => {
    const chartId = appState.addChartSnapshot({ nome: 'Chart A', svgMarkup: '<svg />' });
    const blockA = appState.addPanelBlock('layout-2col');
    const blockB = appState.addPanelBlock('layout-2col');

    appState.assignChartToPanelBlockSlot(blockA, 'slot-1', chartId);

    const state = appState.getState();
    const a = state.panel.blocks.find(b => b.id === blockA);
    const b = state.panel.blocks.find(bk => bk.id === blockB);

    expect(a.slots['slot-1']).toBe(chartId);
    expect(b.slots['slot-1']).toBeUndefined();
  });

  it('migrates legacy panel layout + slots to blocks[0]', () => {
    appState.setPanelLayout('layout-hero2');
    appState.assignChartToSlot('slot-1', null);

    appState.migrateLegacyPanelState();

    const state = appState.getState();
    expect(state.panel.blocks[0].templateId).toBe('layout-hero2');
    expect(state.panel.layout).toBeUndefined();
  });
});
