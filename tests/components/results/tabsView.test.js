// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/services/i18nService.js', () => ({
	t: (key, ...args) => {
		if (key === 'chive-global-filter-trigger-active') {
			// args: [ruleCount, filtered, total]
			return `Filter on • ${args[0]} rules · ${args[1]}/${args[2]}`;
		}
		if (key === 'chive-global-filter-trigger-inactive') {
			return 'Global filter';
		}
		return key;
	},
	getLocale: () => 'en',
}));

function mountTabsDom() {
	document.body.innerHTML = `
		<div id="resultado-tabs">
			<div id="resultado-tabs-grupo">
				<button id="tab-preview"></button>
				<button id="tab-charts"></button>
				<button id="tab-panel"></button>
			</div>
			<div id="resultado-tabs-acoes">
				<button id="btn-global-filter" hidden disabled>
					<span id="global-filter-trigger-label">Global filter</span>
				</button>
			</div>
		</div>
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

	it('hides global filter trigger when not on charts tab', async () => {
		const { updateTabs } = await import('../../../src/components/results/tabsView.js');

		updateTabs('preview', vi.fn(), null, {
			triggerState: { hasDataset: true, globalFilter: { column: null }, filteredCount: 0, totalCount: 0 },
		});

		const trigger = document.getElementById('btn-global-filter');
		expect(trigger.hidden).toBe(true);
	});

	it('shows disabled trigger on charts tab with no dataset', async () => {
		const { updateTabs } = await import('../../../src/components/results/tabsView.js');

		updateTabs('charts', vi.fn(), null, {
			triggerState: { hasDataset: false, globalFilter: null, filteredCount: 0, totalCount: 0 },
		});

		const trigger = document.getElementById('btn-global-filter');
		expect(trigger.hidden).toBe(false);
		expect(trigger.disabled).toBe(true);
	});

	it('renders active indicator with rule count and X/Y when rules exist', async () => {
		const { updateTabs } = await import('../../../src/components/results/tabsView.js');

		updateTabs('charts', vi.fn(), null, {
			triggerState: {
				hasDataset: true,
				globalFilter: {
					rules: [
						{ column: 'region', include: ['v:A'] },
						{ column: 'age', operator: 'gt', value: '10' },
					],
				},
				filteredCount: 7,
				totalCount: 20,
			},
		});

		const trigger = document.getElementById('btn-global-filter');
		const label = document.getElementById('global-filter-trigger-label');
		expect(trigger.hidden).toBe(false);
		expect(trigger.disabled).toBe(false);
		expect(trigger.dataset.active).toBe('true');
		expect(label.textContent).toBe('Filter on • 2 rules · 7/20');
	});

	it('renders neutral label when there are no rules', async () => {
		const { updateTabs } = await import('../../../src/components/results/tabsView.js');

		updateTabs('charts', vi.fn(), null, {
			triggerState: {
				hasDataset: true,
				globalFilter: { rules: [] },
				filteredCount: 20,
				totalCount: 20,
			},
		});

		const label = document.getElementById('global-filter-trigger-label');
		expect(label.textContent).toBe('Global filter');
	});

	it('opens filter dialog only when trigger is enabled', async () => {
		const { updateTabs } = await import('../../../src/components/results/tabsView.js');
		const onOpen = vi.fn();

		updateTabs('charts', vi.fn(), null, {
			onGlobalFilterOpen: onOpen,
			triggerState: {
				hasDataset: false,
				globalFilter: { rules: [] },
				filteredCount: 0,
				totalCount: 0,
			},
		});

		document.getElementById('btn-global-filter').click();
		expect(onOpen).not.toHaveBeenCalled();

		updateTabs('charts', vi.fn(), null, {
			onGlobalFilterOpen: onOpen,
			triggerState: {
				hasDataset: true,
				globalFilter: { rules: [] },
				filteredCount: 0,
				totalCount: 10,
			},
		});

		document.getElementById('btn-global-filter').click();
		expect(onOpen).toHaveBeenCalledTimes(1);
	});
});
