import { describe, expect, it, vi } from 'vitest';

// Guards the orchestrator's one real job: calling every setup exactly once, in a
// fixed boot order. All nine setups are mocked, so no real listeners register and
// this stays independent of the DOM-integration suite in eventHandlers.test.js.
const mocks = vi.hoisted(() => ({
  setupFileInputListeners: vi.fn(),
  setupTabListeners: vi.fn(),
  setupSidebarToggleListener: vi.fn(),
  setupPanelEventListeners: vi.fn(),
  setupSidebarNavigationButtons: vi.fn(),
  setupProjectTransferListeners: vi.fn(),
  setupChartActionListeners: vi.fn(),
  setupGlobalKeyboardListeners: vi.fn(),
  setupDatasetListeners: vi.fn(),
}));

vi.mock('../../src/features/datasetWorkspace/datasetController.js', () => ({
  setupFileInputListeners: mocks.setupFileInputListeners,
}));

vi.mock('../../src/app/uiManager.js', () => ({
  setupTabListeners: mocks.setupTabListeners,
  setupSidebarToggleListener: mocks.setupSidebarToggleListener,
}));

vi.mock('../../src/features/panel/panelController.js', () => ({
  setupPanelEventListeners: mocks.setupPanelEventListeners,
}));

vi.mock('../../src/app/bindings/sidebarNavigation.js', () => ({
  setupSidebarNavigationButtons: mocks.setupSidebarNavigationButtons,
}));

vi.mock('../../src/app/bindings/projectTransfer.js', () => ({
  setupProjectTransferListeners: mocks.setupProjectTransferListeners,
}));

vi.mock('../../src/app/bindings/chartActions.js', () => ({
  setupChartActionListeners: mocks.setupChartActionListeners,
}));

vi.mock('../../src/app/bindings/keyboardShortcuts.js', () => ({
  setupGlobalKeyboardListeners: mocks.setupGlobalKeyboardListeners,
}));

vi.mock('../../src/features/datasetWorkspace/bindings/datasetActions.js', () => ({
  setupDatasetListeners: mocks.setupDatasetListeners,
}));

import { initializeDomBindings } from '../../src/app/domBindings.js';

describe('eventHandlers orchestration order', () => {
  // Setups in their documented boot order.
  const orderedSetups = [
    mocks.setupFileInputListeners,
    mocks.setupTabListeners,
    mocks.setupSidebarToggleListener,
    mocks.setupSidebarNavigationButtons,
    mocks.setupPanelEventListeners,
    mocks.setupProjectTransferListeners,
    mocks.setupChartActionListeners,
    mocks.setupGlobalKeyboardListeners,
    mocks.setupDatasetListeners,
  ];

  it('calls every setup exactly once, in boot order', () => {
    initializeDomBindings();

    // Each setup ran exactly once (catches a duplicated call that ordering alone
    // would miss).
    for (const setup of orderedSetups) {
      expect(setup).toHaveBeenCalledTimes(1);
    }

    // The full sequence of invocation orders is strictly ascending as listed,
    // so an accidental insertion, drop, or swap fails cleanly.
    const invocationOrder = orderedSetups.map(setup => setup.mock.invocationCallOrder[0]);
    const sortedAscending = [...invocationOrder].sort((a, b) => a - b);
    expect(invocationOrder).toEqual(sortedAscending);
  });
});
