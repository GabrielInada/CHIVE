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
  getActiveTab,
  setTabVisibility,
  setupSidebarToggleListener,
  setupTabListeners,
  switchTab,
  toggleSidebarCollapsed,
  updateSidebarUI,
} from '../../src/app/uiManager.js';

function setupDom() {
  document.body.innerHTML = `
    <button id="tab-preview" data-tab="preview" class="active"></button>
    <button id="tab-charts" data-tab="charts" class="inactive"></button>
    <button id="tab-panel" data-tab="panel" class="inactive"></button>

    <section id="tab-content-preview"></section>
    <section id="tab-content-charts" hidden></section>
    <section id="tab-content-dashboard" hidden></section>

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

  it('returns the active tab and falls back to preview', () => {
    expect(getActiveTab()).toBe('preview');

    document.querySelector('[data-tab="preview"]').classList.remove('active');
    expect(getActiveTab()).toBe('preview');
  });

  it('switchTab updates panel classes and sidebar mode for charts', () => {
    switchTab('charts');

    expect(document.getElementById('tab-charts').classList.contains('active')).toBe(true);
    expect(document.getElementById('tab-content-charts').hidden).toBe(false);
    expect(document.getElementById('tab-content-preview').hidden).toBe(true);
    expect(mocks.setSidebarMode).toHaveBeenCalledWith('viz');
    expect(document.getElementById('sidebar-panel-viz').classList.contains('active')).toBe(true);
  });

  it('ignores switchTab with invalid tab name', () => {
    switchTab('inexistente');
    expect(mocks.setSidebarMode).not.toHaveBeenCalled();
    expect(document.getElementById('tab-preview').classList.contains('active')).toBe(true);
  });

  it('setTabVisibility and updateSidebarUI apply correct visibility', () => {
    setTabVisibility('panel', true);
    expect(document.getElementById('tab-content-dashboard').hidden).toBe(false);

    setTabVisibility('panel', false);
    expect(document.getElementById('tab-content-dashboard').hidden).toBe(true);

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

  it('registers tab listeners and sidebar toggle', () => {
    setupTabListeners();
    setupSidebarToggleListener();

    document.getElementById('tab-panel').click();
    expect(document.getElementById('tab-content-dashboard').hidden).toBe(false);
    expect(mocks.setSidebarMode).toHaveBeenCalledWith('panel');

    const before = document.getElementById('btn-toggle-sidebar').getAttribute('aria-expanded');
    document.getElementById('btn-toggle-sidebar').click();
    expect(document.getElementById('btn-toggle-sidebar').getAttribute('aria-expanded')).not.toBe(before);
  });
});
