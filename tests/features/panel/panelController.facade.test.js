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
      CHART_SNAPSHOT_ADDED: 'chart-added',
      CHART_SNAPSHOT_REMOVED: 'chart-removed',
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
    addPanelBlock: vi.fn(),
    removePanelBlock: vi.fn(),
    movePanelBlock: vi.fn(),
    setPanelBlockTemplate: vi.fn(),
    updatePanelBlockBorder: vi.fn(),
    assignChartToPanelBlockSlot: vi.fn(),
    updatePanelBlockProportions: vi.fn(),
    updatePanelBlockHeight: vi.fn(),
    repairPanelSlotReferences: vi.fn(),
    clearPanel: vi.fn(),
    onStateChange: vi.fn(),
  },
  panelView: {
    renderSidebarPanel: vi.fn(),
    renderCanvasPanel: vi.fn(),
  },
  svgExporter: {
    exportPanelLayoutSvg: vi.fn(),
  },
  i18n: {
    t: vi.fn((key) => key),
  },
}));

vi.mock('../../../src/state/appState.js', () => mocks.appState);
vi.mock('../../../src/features/panel/views/panelView.js', () => mocks.panelView);
vi.mock('../../../src/features/panel/export/svgExporter.js', () => mocks.svgExporter);
vi.mock('../../../src/services/i18nService.js', () => mocks.i18n);

describe('panelController facade branches', () => {
  let panelController;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    document.body.innerHTML = '';

    mocks.appState.getActiveDataset.mockReturnValue({
      name: 'Dataset',
      columns: [{ name: 'value', type: 'number' }],
      rows: [{ value: 1 }],
      metadata: { summary: 'One row' },
      config: {},
    });
    mocks.appState.addPanelBlock.mockReturnValue('block-2');
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

  it('wires the export control with success and failure feedback', () => {
    const feedback = vi.fn();
    document.body.innerHTML = '<button id="btn-export-panel"></button>';

    panelController.initPanelController(feedback);
    panelController.setupPanelEventListeners();

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
