// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

function mountTabsDom() {
	document.body.innerHTML = `
		<button id="tab-preview"></button>
		<button id="tab-charts"></button>
		<button id="tab-panel"></button>
		<section id="painel-preview"></section>
		<section id="painel-charts"></section>
		<section id="painel-panel"></section>
	`;
}

describe('tabsView', () => {
	beforeEach(() => {
		vi.resetModules();
		mountTabsDom();
	});

	it('updates active tab and panel classes', async () => {
		const { updateTabs } = await import('../../../src/components/results/tabsView.js');

		updateTabs('charts', vi.fn());

		expect(document.getElementById('tab-charts').classList.contains('ativo')).toBe(true);
		expect(document.getElementById('painel-charts').classList.contains('ativo')).toBe(true);
		expect(document.getElementById('tab-preview').classList.contains('ativo')).toBe(false);
		expect(document.getElementById('painel-preview').classList.contains('ativo')).toBe(false);
		expect(document.getElementById('tab-panel').classList.contains('ativo')).toBe(false);
		expect(document.getElementById('painel-panel').classList.contains('ativo')).toBe(false);
	});

	it('registers listeners once and always uses latest callback', async () => {
		const { updateTabs } = await import('../../../src/components/results/tabsView.js');
		const firstCallback = vi.fn();
		const latestCallback = vi.fn();

		updateTabs('preview', firstCallback);
		updateTabs('preview', latestCallback);
		updateTabs('preview', latestCallback);

		document.getElementById('tab-charts').click();

		expect(firstCallback).not.toHaveBeenCalled();
		expect(latestCallback).toHaveBeenCalledTimes(1);
		expect(latestCallback).toHaveBeenCalledWith({ aba: 'charts' });
	});

	it('does nothing on click when callback is missing', async () => {
		const { updateTabs } = await import('../../../src/components/results/tabsView.js');

		updateTabs('preview');

		expect(() => {
			document.getElementById('tab-preview').click();
			document.getElementById('tab-charts').click();
			document.getElementById('tab-panel').click();
		}).not.toThrow();
	});
});
