// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import * as appState from '../src/modules/appState.js';
import { initializeLayoutSelector, renderCanvasPanel } from '../src/modules/panelManager.js';

function setupDom() {
  document.body.innerHTML = `
    <select id="select-panel-layout"></select>
    <div id="panel-layout-canvas"></div>
    <div id="lista-painel-charts"></div>
    <button id="btn-exportar-painel" type="button"></button>
  `;
}

describe('panelManager multi-block canvas (phase 2)', () => {
  beforeEach(() => {
    appState.resetState();
    setupDom();

    window.matchMedia = window.matchMedia || (() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
  });

  it('renders one visual block for each panel block in state', () => {
    appState.addPanelBlock('layout-single');

    renderCanvasPanel();

    const blockEls = document.querySelectorAll('.painel-block[data-panel-block-id]');
    expect(blockEls.length).toBe(2);
  });

  it('adds a new block from canvas control using selected template', () => {
    initializeLayoutSelector();
    const select = document.getElementById('select-panel-layout');
    select.value = 'layout-single';

    renderCanvasPanel();

    const addBtn = document.querySelector('[data-panel-add-block]');
    expect(addBtn).toBeTruthy();

    addBtn.click();

    const state = appState.getState();
    expect(state.panel.blocks.length).toBe(2);
    expect(state.panel.blocks[1].templateId).toBe('layout-single');
  });

  it('moves block order down when clicking block down control', () => {
    const secondId = appState.addPanelBlock('layout-single');

    renderCanvasPanel();

    const firstBlockId = appState.getState().panel.blocks[0].id;
    const downBtn = document.querySelector(`[data-panel-block-down="${firstBlockId}"]`);
    expect(downBtn).toBeTruthy();

    downBtn.click();

    const state = appState.getState();
    expect(state.panel.blocks[1].id).toBe(firstBlockId);
    expect(state.panel.blocks[0].id).toBe(secondId);
  });

  it('updates block proportions from guided drag handles', () => {
    const blockId = appState.getState().panel.blocks[0].id;

    renderCanvasPanel();

    const grid = document.querySelector(`[data-panel-layout-block="${blockId}"]`);
    grid.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 400,
      height: 200,
      right: 400,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const handle = document.querySelector(`[data-panel-resize-handle="${blockId}:split"]`);
    expect(handle).toBeTruthy();

    handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 200, clientY: 50 }));
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 280, clientY: 50 }));
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    const state = appState.getState();
    const block = state.panel.blocks.find(b => b.id === blockId);
    expect(block.proportions.split).toBe(70);
  });

  it('changes block template from block-level selector', () => {
    const blockId = appState.getState().panel.blocks[0].id;

    renderCanvasPanel();

    const templateSelect = document.querySelector(`[data-panel-block-template="${blockId}"]`);
    expect(templateSelect).toBeTruthy();

    templateSelect.value = 'layout-hero2';
    templateSelect.dispatchEvent(new Event('change', { bubbles: true }));

    const state = appState.getState();
    const block = state.panel.blocks.find(b => b.id === blockId);
    expect(block.templateId).toBe('layout-hero2');

    const slot3 = document.querySelector(
      `.painel-block[data-panel-block-id="${blockId}"] [data-panel-slot="slot-3"]`
    );
    expect(slot3).toBeTruthy();
  });

  it('swaps chart assignments across blocks via drop', () => {
    window.matchMedia = () => ({
      matches: true,
      media: '(min-width: 901px)',
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });

    const chartA = appState.addChartSnapshot({ nome: 'A', svgMarkup: '<svg />' });
    const blockB = appState.addPanelBlock('layout-2col');
    const chartB = appState.addChartSnapshot({ nome: 'B', svgMarkup: '<svg />' });

    const blockA = appState.getState().panel.blocks[0].id;
    appState.assignChartToPanelBlockSlot(blockA, 'slot-1', chartA);
    appState.assignChartToPanelBlockSlot(blockB, 'slot-1', chartB);

    renderCanvasPanel();

    const sourceSlot = document.querySelector(
      `.painel-block[data-panel-block-id="${blockA}"] [data-panel-slot="slot-1"]`
    );
    const targetSlot = document.querySelector(
      `.painel-block[data-panel-block-id="${blockB}"] [data-panel-slot="slot-1"]`
    );
    expect(sourceSlot).toBeTruthy();
    expect(targetSlot).toBeTruthy();

    const payload = new Map([
      ['text/panel-slot-id', 'slot-1'],
      ['text/panel-block-id', blockA],
      ['text/panel-chart-id', String(chartA)],
    ]);

    targetSlot.dispatchEvent(
      new Event('dragover', {
        bubbles: true,
        cancelable: true,
      })
    );

    const dropEvent = new Event('drop', {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: {
        getData: key => payload.get(key) || '',
      },
    });

    targetSlot.dispatchEvent(dropEvent);

    const state = appState.getState();
    const nextBlockA = state.panel.blocks.find(b => b.id === blockA);
    const nextBlockB = state.panel.blocks.find(b => b.id === blockB);
    expect(nextBlockA.slots['slot-1']).toBe(chartB);
    expect(nextBlockB.slots['slot-1']).toBe(chartA);
  });
});
