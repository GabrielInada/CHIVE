// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// These tests target the module-level guard flags in the eventHandlers/ workflow
// modules, so every test needs a guaranteed-fresh guard. vi.resetModules() +
// dynamic import (below) resets the flags; the dependency mocks stay hoisted and
// re-apply to whatever copy is imported after the reset. The four modules under
// test are imported ONLY dynamically after the reset, never at the top level, or a
// cached pre-reset copy would defeat the guard-reset.
const mocks = vi.hoisted(() => ({
  isAnyDialogOpen: vi.fn(() => false),
  selectDataset: vi.fn(),
  removeDatasetByIndex: vi.fn(),
  t: vi.fn(key => `tr:${key}`),
  downloadSvgFromContainer: vi.fn(() => ({ ok: true })),
  addChartToPanel: vi.fn(() => ({ ok: true })),
  showError: vi.fn(),
  showFeedback: vi.fn(),
  showProgress: vi.fn(),
  getActiveDataset: vi.fn(() => null),
  getPersistenceSnapshot: vi.fn(() => ({})),
  replaceAllState: vi.fn(),
  updateActiveDatasetConfig: vi.fn(),
  exportProject: vi.fn(),
  importProjectBytes: vi.fn(),
  getProjectImportErrorMessageKey: vi.fn(),
  downloadBytes: vi.fn(),
}));

vi.mock('../../../src/services/i18nService.js', () => ({ t: mocks.t }));
vi.mock('../../../src/utils/svgExport.js', () => ({ downloadSvgFromContainer: mocks.downloadSvgFromContainer }));
vi.mock('../../../src/utils/downloadBytes.js', () => ({ downloadBytes: mocks.downloadBytes }));
vi.mock('../../../src/services/persistence.js', () => ({
  PROJECT_FILE_MIME: 'application/vnd.chive.project+sqlite3',
  exportProject: mocks.exportProject,
  importProjectBytes: mocks.importProjectBytes,
  getProjectImportErrorMessageKey: mocks.getProjectImportErrorMessageKey,
}));
vi.mock('../../../src/features/panel/panelController.js', () => ({
  addChartToPanel: mocks.addChartToPanel,
  setupPanelEventListeners: vi.fn(),
}));
vi.mock('../../../src/ui/feedback.js', () => ({
  showError: mocks.showError,
  showFeedback: mocks.showFeedback,
  showProgress: mocks.showProgress,
}));
vi.mock('../../../src/features/datasetWorkspace/datasetController.js', () => ({
  setupFileInputListeners: vi.fn(),
  selectDataset: mocks.selectDataset,
  removeDatasetByIndex: mocks.removeDatasetByIndex,
}));
vi.mock('../../../src/app/uiManager.js', () => ({
  setupTabListeners: vi.fn(),
  setupSidebarToggleListener: vi.fn(),
  switchTab: vi.fn(),
}));
vi.mock('../../../src/state/appState.js', () => ({
  getActiveDataset: mocks.getActiveDataset,
  getPersistenceSnapshot: mocks.getPersistenceSnapshot,
  replaceAllState: mocks.replaceAllState,
  updateActiveDatasetConfig: mocks.updateActiveDatasetConfig,
}));
vi.mock('../../../src/ui/dialogFocus.js', () => ({ isAnyDialogOpen: mocks.isAnyDialogOpen }));

const PROJECT_MENU_HTML = `
  <div class="project-menu">
    <button id="btn-project-menu" type="button" aria-expanded="false"></button>
    <div id="project-menu-panel" hidden>
      <button id="btn-project-export" type="button"></button>
      <button id="btn-project-export-work-only" type="button"></button>
      <button id="btn-project-import" type="button"></button>
    </div>
  </div>
  <input id="project-import-input" type="file" />
`;

// Real listeners attached during behavioral tests are tracked here so afterEach can
// remove them; vi.resetModules() resets the guard flags but does NOT detach a
// listener already bound to the persistent jsdom document.
let trackedListeners = [];

// Registration-count tests: mock addEventListener as a no-op so nothing real
// attaches. Assert on the spy's calls.
function spyNoopAddEventListener() {
  return vi.spyOn(document, 'addEventListener').mockImplementation(() => {});
}

// Behavioral tests: use the real addEventListener but capture every registration so
// afterEach can remove it. Grab the original before spying and invoke it via
// original.call(document, ...) to avoid recursing into the spy and to keep `this`.
function spyTrackedAddEventListener() {
  const original = document.addEventListener;
  return vi.spyOn(document, 'addEventListener').mockImplementation((type, handler, options) => {
    trackedListeners.push([type, handler, options]);
    return original.call(document, type, handler, options);
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

afterEach(() => {
  for (const [type, handler, options] of trackedListeners) {
    document.removeEventListener(type, handler, options);
  }
  trackedListeners = [];
  vi.restoreAllMocks();
});

describe('eventHandlers global-listener idempotence', () => {
  it('setupGlobalKeyboardListeners registers its keydown listener only once', async () => {
    const addSpy = spyNoopAddEventListener();
    const { setupGlobalKeyboardListeners } = await import('../../../src/app/bindings/keyboardShortcuts.js');

    setupGlobalKeyboardListeners();
    setupGlobalKeyboardListeners();

    const keydownCalls = addSpy.mock.calls.filter(([type]) => type === 'keydown');
    expect(keydownCalls).toHaveLength(1);
  });

  it('setupDatasetListeners registers its click listener only once', async () => {
    const addSpy = spyNoopAddEventListener();
    const { setupDatasetListeners } = await import('../../../src/features/datasetWorkspace/bindings/datasetActions.js');

    setupDatasetListeners();
    setupDatasetListeners();

    const clickCalls = addSpy.mock.calls.filter(([type]) => type === 'click');
    expect(clickCalls).toHaveLength(1);
  });

  it('setupChartActionListeners registers its click listener only once', async () => {
    const addSpy = spyNoopAddEventListener();
    const { setupChartActionListeners } = await import('../../../src/app/bindings/chartActions.js');

    setupChartActionListeners();
    setupChartActionListeners();

    const clickCalls = addSpy.mock.calls.filter(([type]) => type === 'click');
    expect(clickCalls).toHaveLength(1);
  });

  it('setupProjectTransferListeners registers its document dismiss listeners only once', async () => {
    const addSpy = spyNoopAddEventListener();
    const { setupProjectTransferListeners } = await import('../../../src/app/bindings/projectTransfer.js');

    setupProjectTransferListeners();
    setupProjectTransferListeners();

    // Element listeners land on buttons, not document, so only the two dismiss
    // listeners reach the document spy.
    expect(addSpy.mock.calls.filter(([type]) => type === 'click')).toHaveLength(1);
    expect(addSpy.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(1);
  });

  it('dataset action still fires exactly once after two setups (end-to-end wiring)', async () => {
    // Sanity check only, not the idempotence proof: because onDatasetClick is a
    // stable named reference, the DOM dedupes identical addEventListener calls, so
    // this would fire once even without the guard. The registration-count tests are
    // the real proof. See the plan's Tests section.
    spyTrackedAddEventListener();
    document.body.innerHTML = '<button data-dataset-select="2" type="button"></button>';
    const { setupDatasetListeners } = await import('../../../src/features/datasetWorkspace/bindings/datasetActions.js');

    setupDatasetListeners();
    setupDatasetListeners();
    mocks.selectDataset.mockClear();

    document.querySelector('[data-dataset-select="2"]').click();

    expect(mocks.selectDataset).toHaveBeenCalledTimes(1);
    expect(mocks.selectDataset).toHaveBeenCalledWith(2);
  });

  it('project menu dismiss uses the current panel after the DOM is rebuilt', async () => {
    // Guards the stale-capture fix: the once-registered outside-click handler must
    // look the panel up fresh, not hold the element present at setup time.
    spyTrackedAddEventListener();
    document.body.innerHTML = PROJECT_MENU_HTML;
    const { setupProjectTransferListeners } = await import('../../../src/app/bindings/projectTransfer.js');
    setupProjectTransferListeners();

    // Rebuild the menu (new panel B) and open it directly; do not re-run setup.
    document.body.innerHTML = PROJECT_MENU_HTML;
    const panelB = document.getElementById('project-menu-panel');
    panelB.hidden = false;

    // Use document.body to match the existing outside-click integration path.
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(panelB.hidden).toBe(true);
  });

  it('treats a document-target click as outside the project menu', async () => {
    spyTrackedAddEventListener();
    document.body.innerHTML = PROJECT_MENU_HTML;
    const { setupProjectTransferListeners } = await import('../../../src/app/bindings/projectTransfer.js');
    setupProjectTransferListeners();

    const panel = document.getElementById('project-menu-panel');
    panel.hidden = false;

    expect(() => document.dispatchEvent(new MouseEvent('click', { bubbles: true }))).not.toThrow();
    expect(panel.hidden).toBe(true);
  });

  it('registers dismiss listeners even when the menu is absent at setup time', async () => {
    // Covers the intentional widening: the dismiss listeners live outside the
    // menuButton && menuPanel guard. Call setup ONCE with no menu; do not re-run it
    // after inserting the menu, or an implementation that only registers inside that
    // guard would pass falsely.
    spyTrackedAddEventListener();
    const { setupProjectTransferListeners } = await import('../../../src/app/bindings/projectTransfer.js');
    setupProjectTransferListeners();

    document.body.innerHTML = PROJECT_MENU_HTML;
    const panel = document.getElementById('project-menu-panel');
    panel.hidden = false;

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(panel.hidden).toBe(true);
  });
});
