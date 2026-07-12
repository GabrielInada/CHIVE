// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  appState: {
    STATE_EVENTS: {
      PANEL_BLOCKS_CHANGED: 'panel-blocks-changed',
      PANEL_CHARTS_CHANGED: 'panel-charts-changed',
      ACTIVE_DATASET_CHANGED: 'active-dataset-changed',
      DATASET_CONFIG_CHANGED: 'dataset-config-changed',
      GLOBAL_FILTER_CHANGED: 'global-filter-changed',
      CHART_ADDED: 'chart-added',
      CHART_REMOVED: 'chart-removed',
      PANEL_CLEARED: 'panel-cleared',
      PANEL_BLOCK_SLOT_ASSIGNED: 'panel-block-slot-assigned',
      PANEL_BLOCK_ADDED: 'panel-block-added',
      PANEL_BLOCK_REMOVED: 'panel-block-removed',
      PANEL_BLOCK_MOVED: 'panel-block-moved',
      PANEL_BLOCK_TEMPLATE_CHANGED: 'panel-block-template-changed',
      PANEL_BLOCK_PROPORTIONS_UPDATED: 'panel-block-proportions-updated',
      PANEL_BLOCK_HEIGHT_UPDATED: 'panel-block-height-updated',
      PANEL_BLOCK_BORDER_UPDATED: 'panel-block-border-updated',
    },
    addChartSnapshot: vi.fn(),
    removeChartSnapshot: vi.fn(),
    getChartSnapshot: vi.fn(),
    getActiveDataset: vi.fn(),
    getPanelBlocks: vi.fn(),
    addPanelBlock: vi.fn(),
    removePanelBlock: vi.fn(),
    movePanelBlock: vi.fn(),
    setPanelBlockTemplate: vi.fn(),
    updatePanelBlockBorder: vi.fn(),
    assignChartToPanelBlockSlot: vi.fn(),
    updatePanelBlockProportions: vi.fn(),
    updatePanelBlockHeight: vi.fn(),
    validatePanelSlots: vi.fn(),
    clearPanel: vi.fn(),
    onStateChange: vi.fn(),
  },
  panelView: {
    renderSidebarPanel: vi.fn(),
    renderCanvasPanel: vi.fn(),
    fillLayoutSelect: vi.fn(),
  },
  svgExporter: {
    exportPanelLayoutSvg: vi.fn(),
  },
  i18n: {
    t: vi.fn((key) => key),
  },
}));

vi.mock('../../../src/modules/state/appState.js', () => mocks.appState);
vi.mock('../../../src/features/panel/views/panelView.js', () => mocks.panelView);
vi.mock('../../../src/features/panel/export/svgExporter.js', () => mocks.svgExporter);
vi.mock('../../../src/services/i18nService.js', () => mocks.i18n);
vi.mock('../../../src/config/chartDefaults.js', () => ({
  mergeChartConfigWithDefaults: vi.fn((type, config) => config || {}),
}));
vi.mock('../../../src/utils/globalFilter.js', () => ({
  applyGlobalFilterRules: vi.fn((rows) => rows),
  resolveGlobalFilterForColumns: vi.fn(() => ({ rules: [] })),
}));
vi.mock('../../../src/utils/columnHelpers.js', () => ({
  getNumericColumnNames: vi.fn(() => ['value']),
}));

describe('panelController facade branches', () => {
  let panelController;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    document.body.innerHTML = '';

    mocks.appState.getPanelBlocks.mockReturnValue([{ id: 'block-1', slots: [] }]);
    mocks.appState.getActiveDataset.mockReturnValue({
      name: 'Dataset',
      columns: [{ name: 'value', type: 'number' }],
      rows: [{ value: 1 }],
      metadata: { summary: 'One row' },
      config: {},
    });
    mocks.appState.addPanelBlock.mockReturnValue('block-2');
    mocks.appState.validatePanelSlots.mockReturnValue({ valid: true });
    mocks.appState.onStateChange.mockReturnValue(vi.fn());
    mocks.appState.getChartSnapshot.mockReturnValue({ id: 'chart-1' });
    mocks.svgExporter.exportPanelLayoutSvg.mockReturnValue({ ok: true });

    panelController = await import('../../../src/features/panel/panelController.js');
  });

  it('registers listeners once and uses the latest feedback callback', () => {
    const firstFeedback = vi.fn();
    const latestFeedback = vi.fn();

    panelController.initPanelController(firstFeedback);
    panelController.initPanelController(latestFeedback);

    expect(mocks.appState.onStateChange).toHaveBeenCalledTimes(11);
    const registeredEvents = mocks.appState.onStateChange.mock.calls.map(([event]) => event);
    expect(registeredEvents).toContain('panel-cleared');

    panelController.renderCanvasPanel();
    const callbacks = mocks.panelView.renderCanvasPanel.mock.calls.at(-1)[0];

    mocks.appState.addPanelBlock.mockReturnValueOnce(null);
    callbacks.onAddBlock('template-single');

    expect(latestFeedback).toHaveBeenCalledWith('chive-panel-max-blocks');
    expect(firstFeedback).not.toHaveBeenCalled();
  });

  it('passes canvas callbacks through to panel state operations', () => {
    panelController.renderCanvasPanel();
    const callbacks = mocks.panelView.renderCanvasPanel.mock.calls.at(-1)[0];

    callbacks.onMoveBlock('block-1', 2);
    callbacks.onRemoveBlock('block-1');
    callbacks.onChangeBlockTemplate('block-1', 'template-2col');
    callbacks.onUpdateBlockBorder('block-1', { top: 3 });
    callbacks.onAssignSlot('block-1', 'slot-1', 'chart-1');
    callbacks.onUpdateBlockProportions('block-1', [2, 1]);
    callbacks.onUpdateBlockHeight('block-1', 420);

    expect(mocks.appState.movePanelBlock).toHaveBeenCalledWith('block-1', 2);
    expect(mocks.appState.removePanelBlock).toHaveBeenCalledWith('block-1');
    expect(mocks.appState.setPanelBlockTemplate).toHaveBeenCalledWith('block-1', 'template-2col');
    expect(mocks.appState.updatePanelBlockBorder).toHaveBeenCalledWith('block-1', { top: 3 });
    expect(mocks.appState.assignChartToPanelBlockSlot).toHaveBeenCalledWith('block-1', 'slot-1', 'chart-1');
    expect(mocks.appState.updatePanelBlockProportions).toHaveBeenCalledWith('block-1', [2, 1]);
    expect(mocks.appState.updatePanelBlockHeight).toHaveBeenCalledWith('block-1', 420);
  });

  it('guards layout changes for invalid templates and missing blocks', () => {
    panelController.changeLayout('not-a-template');
    expect(mocks.appState.setPanelBlockTemplate).not.toHaveBeenCalled();

    mocks.appState.getPanelBlocks.mockReturnValueOnce([]);
    panelController.changeLayout('template-2col');
    expect(mocks.appState.setPanelBlockTemplate).not.toHaveBeenCalled();

    mocks.appState.getPanelBlocks.mockReturnValueOnce([{ id: 'block-1' }]);
    panelController.changeLayout('template-2col');
    expect(mocks.appState.setPanelBlockTemplate).toHaveBeenCalledWith('block-1', 'template-2col');
  });

  it('wires layout and export controls with success and failure feedback', () => {
    const feedback = vi.fn();
    document.body.innerHTML = `
      <select id="select-panel-layout">
        <option value="template-single">Single</option>
        <option value="template-2col">Two</option>
      </select>
      <button id="btn-export-panel"></button>
    `;

    panelController.initPanelController(feedback);
    panelController.setupPanelEventListeners();

    const select = document.getElementById('select-panel-layout');
    select.value = 'template-2col';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(mocks.appState.setPanelBlockTemplate).toHaveBeenCalledWith('block-1', 'template-2col');

    const exportButton = document.getElementById('btn-export-panel');
    mocks.svgExporter.exportPanelLayoutSvg.mockReturnValueOnce({ ok: false, reason: 'canvas-not-found' });
    exportButton.click();
    mocks.svgExporter.exportPanelLayoutSvg.mockReturnValueOnce({ ok: false, reason: 'empty-canvas' });
    exportButton.click();
    mocks.svgExporter.exportPanelLayoutSvg.mockReturnValueOnce({ ok: false, reason: 'download-failed' });
    exportButton.click();
    mocks.svgExporter.exportPanelLayoutSvg.mockReturnValueOnce({ ok: false, reason: 'no-exportable-charts' });
    exportButton.click();
    mocks.svgExporter.exportPanelLayoutSvg.mockReturnValueOnce({ ok: true, omittedChartCount: 0 });
    exportButton.click();
    mocks.svgExporter.exportPanelLayoutSvg.mockReturnValueOnce({ ok: true, omittedChartCount: 2 });
    exportButton.click();

    expect(feedback).toHaveBeenCalledWith('Panel canvas not found');
    expect(feedback).toHaveBeenCalledWith('Panel is empty');
    expect(feedback).toHaveBeenCalledWith('chive-panel-export-error');
    expect(feedback).toHaveBeenCalledWith('chive-panel-export-no-exportable');
    expect(feedback).toHaveBeenCalledWith('chive-panel-export-svg');
    expect(feedback).toHaveBeenCalledWith('chive-panel-export-omitted');
    expect(mocks.i18n.t).toHaveBeenCalledWith('chive-panel-export-omitted', 2);
  });

  it('tolerates missing controls and exposes sidebar, clear, lookup, and export helpers', () => {
    const feedback = vi.fn();
    panelController.initPanelController(feedback);

    expect(() => panelController.setupPanelEventListeners()).not.toThrow();

    panelController.initializeLayoutSelector();
    expect(mocks.panelView.fillLayoutSelect).toHaveBeenCalled();

    panelController.renderSidebarPanel();
    const removeChart = mocks.panelView.renderSidebarPanel.mock.calls.at(-1)[0];
    removeChart('chart-1');
    expect(mocks.appState.removeChartSnapshot).toHaveBeenCalledWith('chart-1');

    expect(panelController.getChartById('chart-1')).toEqual({ id: 'chart-1' });

    // clearPanelData delegates to the facade; the re-render is driven by the
    // PANEL_CLEARED subscription (the bus is mocked here, so it does not fan out),
    // not by a direct render call.
    mocks.panelView.renderSidebarPanel.mockClear();
    mocks.panelView.renderCanvasPanel.mockClear();
    panelController.clearPanelData();
    expect(mocks.appState.clearPanel).toHaveBeenCalled();
    expect(mocks.panelView.renderSidebarPanel).not.toHaveBeenCalled();
    expect(mocks.panelView.renderCanvasPanel).not.toHaveBeenCalled();

    expect(panelController.exportPanelLayoutSvg()).toEqual({ ok: true });
    expect(mocks.svgExporter.exportPanelLayoutSvg).toHaveBeenCalled();
  });
});
