// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
		<div class="result-tabs"><button id="btn-toggle-controls"></button></div>
  `;
}

describe('uiManager', () => {
  afterEach(() => vi.unstubAllGlobals());
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

	it('starts narrow controls closed and remembers independent desktop and phone choices', () => {
		let change;
		const media = { matches: true, addEventListener: (_type, listener) => { change = listener; } };
		vi.stubGlobal('matchMedia', () => media);
		setupSidebarToggleListener();
		const button = document.getElementById('btn-toggle-sidebar');
		expect(button.getAttribute('aria-expanded')).toBe('false');
		expect(button.textContent).toBe('tr:chive-sidebar-show-controls');
		button.click();
		expect(button.getAttribute('aria-expanded')).toBe('true');
		expect(button.textContent).toBe('tr:chive-sidebar-hide-controls');

		media.matches = false;
		change();
		expect(button.getAttribute('aria-expanded')).toBe('true');
		button.click();
		expect(button.getAttribute('aria-expanded')).toBe('false');

		media.matches = true;
		change();
		expect(button.getAttribute('aria-expanded')).toBe('true');
		media.matches = false;
		change();
		expect(button.getAttribute('aria-expanded')).toBe('false');
		expect(mocks.setSidebarMode).not.toHaveBeenCalled();
	});

	it('keeps the compact controls button synchronized with sidebar visibility', () => {
		vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {} }));
		setupSidebarToggleListener();
		const compact = document.getElementById('btn-toggle-controls');
		const original = document.getElementById('btn-toggle-sidebar');
		expect(compact.getAttribute('aria-expanded')).toBe('false');
		compact.click();
		expect(compact.getAttribute('aria-expanded')).toBe('true');
		expect(original.getAttribute('aria-expanded')).toBe('true');
		original.click();
		expect(compact.getAttribute('aria-expanded')).toBe('false');
		expect(compact.getAttribute('aria-label')).toBe('tr:chive-sidebar-show-controls');
		expect(mocks.setSidebarMode).not.toHaveBeenCalled();
	});
});
