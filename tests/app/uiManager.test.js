// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  setSidebarMode: vi.fn(),
}));

vi.mock('../../src/services/i18nService.js', () => ({
  t: key => `tr:${key}`,
}));

vi.mock('../../src/state/appState.js', () => ({
  setSidebarMode: mocks.setSidebarMode,
}));

import {
  setupSidebarToggleListener,
  syncSidebarToTab,
  toggleSidebarCollapsed,
  updateSidebarUI,
} from '../../src/app/uiManager.js';

function setupDom() {
  document.body.innerHTML = `
    <aside id="sidebar-panel-data" class="active"></aside>
    <aside id="sidebar-panel-viz" class="inactive"></aside>
    <aside id="sidebar-panel-dashboard" class="inactive"></aside>

    <button id="btn-toggle-sidebar" aria-expanded="true"></button>
  `;
}

describe('uiManager', () => {
  beforeEach(() => {
    mocks.setSidebarMode.mockReset();
    setupDom();
  });

  it('syncs the sidebar mode to a durable charts tab', () => {
    syncSidebarToTab('charts');

    expect(mocks.setSidebarMode).toHaveBeenCalledWith('viz');
    expect(document.getElementById('sidebar-panel-viz').classList.contains('active')).toBe(true);
  });

  it('ignores an invalid tab name', () => {
    syncSidebarToTab('inexistente');
    expect(mocks.setSidebarMode).not.toHaveBeenCalled();
  });

  it('updateSidebarUI applies the active and inactive classes', () => {
    updateSidebarUI('panel');
    expect(document.getElementById('sidebar-panel-dashboard').classList.contains('active')).toBe(true);
    expect(document.getElementById('sidebar-panel-data').classList.contains('inactive')).toBe(true);
  });

  it('uses aria-expanded as the single sidebar collapse state', () => {
    const collapsed = toggleSidebarCollapsed();
    expect(collapsed).toBe(true);

    const btn = document.getElementById('btn-toggle-sidebar');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.getAttribute('aria-label')).toBe('tr:chive-sidebar-expand');
    expect(document.body.classList.contains('sidebar-collapsed')).toBe(false);

    const expanded = toggleSidebarCollapsed();
    expect(expanded).toBe(false);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(btn.getAttribute('aria-label')).toBe('tr:chive-sidebar-collapse');
  });

  it('registers the sidebar toggle', () => {
    setupSidebarToggleListener();

    const before = document.getElementById('btn-toggle-sidebar').getAttribute('aria-expanded');
    document.getElementById('btn-toggle-sidebar').click();
    expect(document.getElementById('btn-toggle-sidebar').getAttribute('aria-expanded')).not.toBe(before);
  });
});
