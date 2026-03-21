// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as appState from '../src/modules/appState.js';

const baixarSvgMarkupMock = vi.fn((svgMarkup, fileNameBase) => {
  return {
    ok: true,
    svgMarkup,
    fileNameBase,
  };
});

vi.mock('../src/utils/svgExport.js', () => ({
  capturarSvgMarkupDeContainer: vi.fn(() => ({ ok: false, reason: 'not-used' })),
  baixarSvgMarkup: (...args) => baixarSvgMarkupMock(...args),
}));

const { renderCanvasPanel, exportPanelLayoutSvg } = await import('../src/modules/panelManager.js');

function setupDom() {
  document.body.innerHTML = `
    <div id="panel-layout-canvas"></div>
    <select id="select-panel-layout"></select>
  `;
}

function rect(left, top, width, height) {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}

describe('panel export composition (phase 2)', () => {
  beforeEach(() => {
    appState.resetState();
    setupDom();
    baixarSvgMarkupMock.mockClear();
    window.matchMedia = () => ({
      matches: false,
      media: '(min-width: 901px)',
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  });

  it('returns empty-canvas when panel canvas has no area', () => {
    const canvas = document.getElementById('panel-layout-canvas');
    canvas.getBoundingClientRect = () => rect(0, 0, 0, 0);

    const result = exportPanelLayoutSvg();

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('empty-canvas');
    expect(baixarSvgMarkupMock).not.toHaveBeenCalled();
  });

  it('exports charts from multiple blocks using slot geometry in canvas coordinates', () => {
    const chartA = appState.addChartSnapshot({
      nome: 'Chart A',
      svgMarkup: '<svg viewBox="0 0 10 10"><rect width="10" height="10" /></svg>',
    });
    const blockB = appState.addPanelBlock('layout-2col');
    const chartB = appState.addChartSnapshot({
      nome: 'Chart B',
      svgMarkup: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" /></svg>',
    });

    const blockA = appState.getState().panel.blocks[0].id;
    appState.assignChartToPanelBlockSlot(blockA, 'slot-1', chartA);
    appState.assignChartToPanelBlockSlot(blockB, 'slot-2', chartB);

    renderCanvasPanel();

    const canvas = document.getElementById('panel-layout-canvas');
    canvas.getBoundingClientRect = () => rect(100, 50, 1000, 800);

    const slotA = document.querySelector(
      `.painel-block[data-panel-block-id="${blockA}"] [data-panel-slot="slot-1"]`
    );
    const slotB = document.querySelector(
      `.painel-block[data-panel-block-id="${blockB}"] [data-panel-slot="slot-2"]`
    );

    slotA.getBoundingClientRect = () => rect(150, 110, 300, 200);
    slotB.getBoundingClientRect = () => rect(500, 460, 400, 250);

    const result = exportPanelLayoutSvg();

    expect(result.ok).toBe(true);
    expect(baixarSvgMarkupMock).toHaveBeenCalledTimes(1);

    const [svgMarkup, fileNameBase] = baixarSvgMarkupMock.mock.calls[0];
    expect(fileNameBase).toBe('panel-layout');

    expect(svgMarkup).toContain('viewBox="0 0 1000 800"');
    expect(svgMarkup).toContain('width="1000"');
    expect(svgMarkup).toContain('height="800"');

    expect(svgMarkup).toMatch(/<svg[^>]*x="50"[^>]*y="60"[^>]*width="300"[^>]*height="200"/);
    expect(svgMarkup).toMatch(/<svg[^>]*x="400"[^>]*y="410"[^>]*width="400"[^>]*height="250"/);
  });

  it('exports charts in deterministic DOM order across blocks and slots', () => {
    const chartA = appState.addChartSnapshot({ nome: 'A', svgMarkup: '<svg><rect width="1" height="1" /></svg>' });
    const blockB = appState.addPanelBlock('layout-2col');
    const chartB = appState.addChartSnapshot({ nome: 'B', svgMarkup: '<svg><rect width="1" height="1" /></svg>' });
    const chartC = appState.addChartSnapshot({ nome: 'C', svgMarkup: '<svg><rect width="1" height="1" /></svg>' });

    const blockA = appState.getState().panel.blocks[0].id;
    appState.assignChartToPanelBlockSlot(blockA, 'slot-1', chartA);
    appState.assignChartToPanelBlockSlot(blockA, 'slot-2', chartB);
    appState.assignChartToPanelBlockSlot(blockB, 'slot-1', chartC);

    renderCanvasPanel();

    const canvas = document.getElementById('panel-layout-canvas');
    canvas.getBoundingClientRect = () => rect(0, 0, 1000, 700);

    const slotA1 = document.querySelector(
      `.painel-block[data-panel-block-id="${blockA}"] [data-panel-slot="slot-1"]`
    );
    const slotA2 = document.querySelector(
      `.painel-block[data-panel-block-id="${blockA}"] [data-panel-slot="slot-2"]`
    );
    const slotB1 = document.querySelector(
      `.painel-block[data-panel-block-id="${blockB}"] [data-panel-slot="slot-1"]`
    );

    slotA1.getBoundingClientRect = () => rect(10, 10, 111, 101);
    slotA2.getBoundingClientRect = () => rect(130, 10, 222, 102);
    slotB1.getBoundingClientRect = () => rect(10, 200, 333, 103);

    const result = exportPanelLayoutSvg();
    expect(result.ok).toBe(true);

    const [svgMarkup] = baixarSvgMarkupMock.mock.calls[0];

    const idxA1 = svgMarkup.indexOf('x="10" y="10" width="111" height="101"');
    const idxA2 = svgMarkup.indexOf('x="130" y="10" width="222" height="102"');
    const idxB1 = svgMarkup.indexOf('x="10" y="200" width="333" height="103"');

    expect(idxA1).toBeGreaterThan(-1);
    expect(idxA2).toBeGreaterThan(-1);
    expect(idxB1).toBeGreaterThan(-1);
    expect(idxA1).toBeLessThan(idxA2);
    expect(idxA2).toBeLessThan(idxB1);
  });

  it('exports all filled slots after template and proportion updates', () => {
    const chart1 = appState.addChartSnapshot({ nome: '1', svgMarkup: '<svg><rect width="1" height="1" /></svg>' });
    const chart2 = appState.addChartSnapshot({ nome: '2', svgMarkup: '<svg><rect width="1" height="1" /></svg>' });
    const chart3 = appState.addChartSnapshot({ nome: '3', svgMarkup: '<svg><rect width="1" height="1" /></svg>' });

    const blockA = appState.getState().panel.blocks[0].id;
    appState.setPanelBlockTemplate(blockA, 'layout-hero2');
    appState.updatePanelBlockProportions(blockA, { splitMain: 68, splitRight: 37 });

    appState.assignChartToPanelBlockSlot(blockA, 'slot-1', chart1);
    appState.assignChartToPanelBlockSlot(blockA, 'slot-2', chart2);
    appState.assignChartToPanelBlockSlot(blockA, 'slot-3', chart3);

    renderCanvasPanel();

    const canvas = document.getElementById('panel-layout-canvas');
    canvas.getBoundingClientRect = () => rect(50, 40, 900, 600);

    const slot1 = document.querySelector(
      `.painel-block[data-panel-block-id="${blockA}"] [data-panel-slot="slot-1"]`
    );
    const slot2 = document.querySelector(
      `.painel-block[data-panel-block-id="${blockA}"] [data-panel-slot="slot-2"]`
    );
    const slot3 = document.querySelector(
      `.painel-block[data-panel-block-id="${blockA}"] [data-panel-slot="slot-3"]`
    );

    slot1.getBoundingClientRect = () => rect(100, 80, 500, 520);
    slot2.getBoundingClientRect = () => rect(620, 80, 280, 240);
    slot3.getBoundingClientRect = () => rect(620, 340, 280, 260);

    const result = exportPanelLayoutSvg();
    expect(result.ok).toBe(true);

    const [svgMarkup] = baixarSvgMarkupMock.mock.calls[0];

    expect(svgMarkup).toContain('viewBox="0 0 900 600"');
    expect(svgMarkup).toMatch(/x="50" y="40" width="500" height="520"/);
    expect(svgMarkup).toMatch(/x="570" y="40" width="280" height="240"/);
    expect(svgMarkup).toMatch(/x="570" y="300" width="280" height="260"/);
  });

  it('exports mixed templates in one composition with stable coordinates', () => {
    const c1 = appState.addChartSnapshot({ nome: 'c1', svgMarkup: '<svg><rect width="1" height="1" /></svg>' });
    const c2 = appState.addChartSnapshot({ nome: 'c2', svgMarkup: '<svg><rect width="1" height="1" /></svg>' });
    const c3 = appState.addChartSnapshot({ nome: 'c3', svgMarkup: '<svg><rect width="1" height="1" /></svg>' });
    const c4 = appState.addChartSnapshot({ nome: 'c4', svgMarkup: '<svg><rect width="1" height="1" /></svg>' });
    const c5 = appState.addChartSnapshot({ nome: 'c5', svgMarkup: '<svg><rect width="1" height="1" /></svg>' });
    const c6 = appState.addChartSnapshot({ nome: 'c6', svgMarkup: '<svg><rect width="1" height="1" /></svg>' });

    const blockA = appState.getState().panel.blocks[0].id;
    const blockB = appState.addPanelBlock('layout-3col');
    const blockC = appState.addPanelBlock('layout-1x2');

    appState.setPanelBlockTemplate(blockA, 'layout-hero2');
    appState.updatePanelBlockProportions(blockA, { splitMain: 66, splitRight: 40 });
    appState.updatePanelBlockProportions(blockB, { a: 25, b: 35, c: 40 });
    appState.updatePanelBlockProportions(blockC, { split: 55 });

    appState.assignChartToPanelBlockSlot(blockA, 'slot-1', c1);
    appState.assignChartToPanelBlockSlot(blockA, 'slot-2', c2);
    appState.assignChartToPanelBlockSlot(blockA, 'slot-3', c3);
    appState.assignChartToPanelBlockSlot(blockB, 'slot-1', c4);
    appState.assignChartToPanelBlockSlot(blockB, 'slot-3', c5);
    appState.assignChartToPanelBlockSlot(blockC, 'slot-2', c6);

    renderCanvasPanel();

    const canvas = document.getElementById('panel-layout-canvas');
    canvas.getBoundingClientRect = () => rect(20, 10, 1200, 900);

    const a1 = document.querySelector(
      `.painel-block[data-panel-block-id="${blockA}"] [data-panel-slot="slot-1"]`
    );
    const a2 = document.querySelector(
      `.painel-block[data-panel-block-id="${blockA}"] [data-panel-slot="slot-2"]`
    );
    const a3 = document.querySelector(
      `.painel-block[data-panel-block-id="${blockA}"] [data-panel-slot="slot-3"]`
    );
    const b1 = document.querySelector(
      `.painel-block[data-panel-block-id="${blockB}"] [data-panel-slot="slot-1"]`
    );
    const b3 = document.querySelector(
      `.painel-block[data-panel-block-id="${blockB}"] [data-panel-slot="slot-3"]`
    );
    const c2slot = document.querySelector(
      `.painel-block[data-panel-block-id="${blockC}"] [data-panel-slot="slot-2"]`
    );

    a1.getBoundingClientRect = () => rect(60, 40, 700, 420);
    a2.getBoundingClientRect = () => rect(780, 40, 350, 180);
    a3.getBoundingClientRect = () => rect(780, 250, 350, 210);
    b1.getBoundingClientRect = () => rect(60, 500, 250, 160);
    b3.getBoundingClientRect = () => rect(560, 500, 400, 160);
    c2slot.getBoundingClientRect = () => rect(60, 700, 900, 170);

    const result = exportPanelLayoutSvg();
    expect(result.ok).toBe(true);

    const [svgMarkup] = baixarSvgMarkupMock.mock.calls[0];

    expect(svgMarkup).toContain('viewBox="0 0 1200 900"');
    expect(svgMarkup).toMatch(/x="40" y="30" width="700" height="420"/);
    expect(svgMarkup).toMatch(/x="760" y="30" width="350" height="180"/);
    expect(svgMarkup).toMatch(/x="760" y="240" width="350" height="210"/);
    expect(svgMarkup).toMatch(/x="40" y="490" width="250" height="160"/);
    expect(svgMarkup).toMatch(/x="540" y="490" width="400" height="160"/);
    expect(svgMarkup).toMatch(/x="40" y="690" width="900" height="170"/);
  });

  it('does not export charts from slots cleared or invalidated by chart removal', () => {
    const kept = appState.addChartSnapshot({ nome: 'kept', svgMarkup: '<svg><rect width="1" height="1" /></svg>' });
    const removed = appState.addChartSnapshot({ nome: 'removed', svgMarkup: '<svg><rect width="1" height="1" /></svg>' });

    const blockA = appState.getState().panel.blocks[0].id;
    appState.assignChartToPanelBlockSlot(blockA, 'slot-1', kept);
    appState.assignChartToPanelBlockSlot(blockA, 'slot-2', removed);

    appState.removeChartSnapshot(removed);

    renderCanvasPanel();

    const canvas = document.getElementById('panel-layout-canvas');
    canvas.getBoundingClientRect = () => rect(0, 0, 800, 500);

    const keptSlot = document.querySelector(
      `.painel-block[data-panel-block-id="${blockA}"] [data-panel-slot="slot-1"]`
    );
    keptSlot.getBoundingClientRect = () => rect(20, 30, 300, 200);

    const result = exportPanelLayoutSvg();
    expect(result.ok).toBe(true);

    const [svgMarkup] = baixarSvgMarkupMock.mock.calls[0];

    const chartTagCount = (svgMarkup.match(/<svg[^>]*\sx="/g) || []).length;
    expect(chartTagCount).toBe(1);
    expect(svgMarkup).toMatch(/x="20" y="30" width="300" height="200"/);
    expect(svgMarkup).not.toMatch(/x="0" y="0" width="0" height="0"/);
  });
});
