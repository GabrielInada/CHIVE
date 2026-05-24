// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  setSidebarMode: vi.fn(),
}));

vi.mock('../src/services/i18nService.js', () => ({
  t: key => `tr:${key}`,
}));

vi.mock('../src/modules/state/appState.js', () => ({
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
} from '../src/modules/uiManager.js';

function setupDom() {
  document.body.innerHTML = `
    <button id="tab-preview" data-aba="preview" class="active"></button>
    <button id="tab-charts" data-aba="charts" class="inactive"></button>
    <button id="tab-panel" data-aba="panel" class="inactive"></button>

    <section id="painel-preview"></section>
    <section id="painel-charts" hidden></section>
    <section id="painel-panel" hidden></section>

    <aside id="sidebar-panel-dados" class="active"></aside>
    <aside id="sidebar-panel-viz" class="inactive"></aside>
    <aside id="sidebar-panel-panel" class="inactive"></aside>

    <button id="btn-toggle-sidebar" aria-expanded="true"></button>
  `;
}

describe('uiManager', () => {
  beforeEach(() => {
    mocks.setSidebarMode.mockReset();
    setupDom();
    document.body.className = '';
  });

  it('retorna a aba ativa e faz fallback para preview', () => {
    expect(getActiveTab()).toBe('preview');

    document.querySelector('[data-aba="preview"]').classList.remove('active');
    expect(getActiveTab()).toBe('preview');
  });

  it('switchTab atualiza classes paineis e sidebar mode para charts', () => {
    switchTab('charts');

    expect(document.getElementById('tab-charts').classList.contains('active')).toBe(true);
    expect(document.getElementById('painel-charts').hidden).toBe(false);
    expect(document.getElementById('painel-preview').hidden).toBe(true);
    expect(mocks.setSidebarMode).toHaveBeenCalledWith('viz');
    expect(document.getElementById('sidebar-panel-viz').classList.contains('active')).toBe(true);
  });

  it('ignora switchTab com aba invalida', () => {
    switchTab('inexistente');
    expect(mocks.setSidebarMode).not.toHaveBeenCalled();
    expect(document.getElementById('tab-preview').classList.contains('active')).toBe(true);
  });

  it('setTabVisibility e updateSidebarUI aplicam visibilidade correta', () => {
    setTabVisibility('panel', true);
    expect(document.getElementById('painel-panel').hidden).toBe(false);

    setTabVisibility('panel', false);
    expect(document.getElementById('painel-panel').hidden).toBe(true);

    updateSidebarUI('panel');
    expect(document.getElementById('sidebar-panel-panel').classList.contains('active')).toBe(true);
    expect(document.getElementById('sidebar-panel-dados').classList.contains('inactive')).toBe(true);
  });

  it('toggleSidebarCollapsed alterna classe e atributos de acessibilidade', () => {
    const collapsed = toggleSidebarCollapsed();
    expect(collapsed).toBe(true);
    expect(document.body.classList.contains('sidebar-collapsed')).toBe(true);

    const btn = document.getElementById('btn-toggle-sidebar');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.getAttribute('aria-label')).toBe('tr:chive-sidebar-expand');

    const expanded = toggleSidebarCollapsed();
    expect(expanded).toBe(false);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(btn.getAttribute('aria-label')).toBe('tr:chive-sidebar-collapse');
  });

  it('registra listeners de aba e toggle da sidebar', () => {
    setupTabListeners();
    setupSidebarToggleListener();

    document.getElementById('tab-panel').click();
    expect(document.getElementById('painel-panel').hidden).toBe(false);
    expect(mocks.setSidebarMode).toHaveBeenCalledWith('panel');

    const before = document.body.classList.contains('sidebar-collapsed');
    document.getElementById('btn-toggle-sidebar').click();
    expect(document.body.classList.contains('sidebar-collapsed')).toBe(!before);
  });
});
