// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import * as appState from '../../../src/modules/appState.js';
import { renderCanvasPanel } from '../../../src/modules/panelManager.js';

function setupDom() {
  document.body.innerHTML = `
    <select id="select-panel-layout"></select>
    <input type="checkbox" id="toggle-panel-slot-borders" />
    <input type="color" id="input-panel-slot-border-color" value="#5d645d" />
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

  it('applies border mode per block from block-local controls', () => {
    const blockB = appState.addPanelBlock('layout-2col');
    renderCanvasPanel();

    const blockAId = appState.getState().panel.blocks[0].id;
    const toggleA = document.getElementById(`toggle-panel-slot-borders-${blockAId}`);
    const colorA = document.getElementById(`input-panel-slot-border-color-${blockAId}`);
    expect(toggleA).toBeTruthy();
    expect(colorA).toBeTruthy();

    toggleA.checked = true;
    toggleA.dispatchEvent(new Event('change', { bubbles: true }));

    const colorAAfterToggle = document.getElementById(`input-panel-slot-border-color-${blockAId}`);
    colorAAfterToggle.value = '#ff0000';
    colorAAfterToggle.dispatchEvent(new Event('change', { bubbles: true }));

    const state = appState.getState();
    const blockA = state.panel.blocks.find(b => b.id === blockAId);
    const blockBState = state.panel.blocks.find(b => b.id === blockB);
    expect(blockA.borderEnabled).toBe(true);
    expect(blockA.borderColor).toBe('#ff0000');
    expect(blockBState.borderEnabled).toBe(false);

    const layoutA = document.querySelector(`[data-panel-layout-block="${blockAId}"]`);
    const layoutB = document.querySelector(`[data-panel-layout-block="${blockB}"]`);
    expect(layoutA.classList.contains('slot-borders-enabled')).toBe(true);
    expect(layoutA.style.getPropertyValue('--panel-slot-border-color')).toBe('#ff0000');
    expect(layoutB.classList.contains('slot-borders-enabled')).toBe(false);
  });

  it('adds a new block from canvas control using selected template', () => {
    renderCanvasPanel();

    const addTemplateSelect = document.querySelector('[data-panel-add-template]');
    expect(addTemplateSelect).toBeTruthy();
    addTemplateSelect.value = 'layout-single';
    addTemplateSelect.dispatchEvent(new Event('change', { bubbles: true }));

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

  it('positions hero2 vertical handle within the right column rail', () => {
    const blockId = appState.getState().panel.blocks[0].id;
    appState.setPanelBlockTemplate(blockId, 'layout-hero2');
    appState.updatePanelBlockProportions(blockId, { splitMain: 70, splitRight: 45 });

    renderCanvasPanel();

    const handle = document.querySelector(`[data-panel-resize-handle="${blockId}:splitRight"]`);
    expect(handle).toBeTruthy();
    expect(handle.style.left).toBe('85%');
    expect(handle.style.width).toBe('');

    const rail = document.querySelector('.painel-block[data-panel-block-id="' + blockId + '"] .painel-resize-rail.eixo-y');
    expect(rail).toBeTruthy();
    expect(rail.style.left).toBe('85%');
    expect(rail.style.width).toBe('calc(30% - 10px)');
  });

  it('grows vertical-template block height at extreme split with limits', () => {
    const blockId = appState.getState().panel.blocks[0].id;
    appState.setPanelBlockTemplate(blockId, 'layout-1x2');
    appState.updatePanelBlockProportions(blockId, { split: 80 });

    renderCanvasPanel();

    const grid = document.querySelector(`[data-panel-layout-block="${blockId}"]`);
    expect(grid).toBeTruthy();

    const minHeight = Number.parseInt(grid.style.minHeight, 10);
    expect(Number.isFinite(minHeight)).toBe(true);
    expect(minHeight).toBeGreaterThan(220);
    expect(minHeight).toBeLessThanOrEqual(620);
  });

  it('resizes full block height with bottom drag handle within bounds', () => {
    const blockId = appState.getState().panel.blocks[0].id;
    renderCanvasPanel();

    const grid = document.querySelector(`[data-panel-layout-block="${blockId}"]`);
    grid.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 500,
      height: 260,
      right: 500,
      bottom: 260,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const handle = document.querySelector(`[data-panel-block-resize="${blockId}"]`);
    expect(handle).toBeTruthy();

    handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientY: 120 }));
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientY: 420 }));
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    const state = appState.getState();
    const block = state.panel.blocks.find(b => b.id === blockId);
    expect(block.heightPx).toBeGreaterThanOrEqual(220);
    expect(block.heightPx).toBeLessThanOrEqual(760);
    expect(block.heightPx).toBe(560);
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
