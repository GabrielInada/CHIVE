// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/services/i18nService.js', () => ({
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
		<div id="result-tabs">
			<div id="result-tabs-group">
				<button id="tab-preview" data-tab="preview"></button>
				<button id="tab-charts" data-tab="charts"></button>
				<button id="tab-panel" data-tab="panel"></button>
			</div>
			<div id="result-tabs-actions">
				<button id="btn-global-filter" hidden disabled>
					<span id="global-filter-trigger-label">Global filter</span>
					<span id="global-filter-trigger-badge" hidden></span>
				</button>
			</div>
		</div>
		<section id="tab-content-preview"></section>
		<section id="tab-content-charts"></section>
		<section id="tab-content-dashboard"></section>
	`;
}

describe('tabsView', () => {
	beforeEach(() => {
		vi.resetModules();
		mountTabsDom();
	});

	it('updates active tab and panel classes', async () => {
		const { updateTabs } = await import('../../../../src/features/datasetWorkspace/views/tabsView.js');

		updateTabs('charts', vi.fn());

		expect(document.getElementById('tab-charts').classList.contains('active')).toBe(true);
		expect(document.getElementById('tab-content-charts').classList.contains('active')).toBe(true);
		expect(document.getElementById('tab-preview').classList.contains('active')).toBe(false);
		expect(document.getElementById('tab-content-preview').classList.contains('active')).toBe(false);
		expect(document.getElementById('tab-panel').classList.contains('active')).toBe(false);
		expect(document.getElementById('tab-content-dashboard').classList.contains('active')).toBe(false);
		expect(document.getElementById('tab-charts').getAttribute('aria-selected')).toBe('true');
		expect(document.getElementById('tab-charts').tabIndex).toBe(0);
		expect(document.getElementById('tab-preview').tabIndex).toBe(-1);
		expect(document.getElementById('tab-content-preview').hidden).toBe(true);
		expect(document.getElementById('tab-content-charts').hidden).toBe(false);
	});

	it('uses manual keyboard activation with roving focus', async () => {
		const { updateTabs } = await import('../../../../src/features/datasetWorkspace/views/tabsView.js');
		const onChange = vi.fn();
		updateTabs('preview', onChange);

		const preview = document.getElementById('tab-preview');
		const charts = document.getElementById('tab-charts');
		preview.focus();
		preview.dispatchEvent(new KeyboardEvent('keydown', {
			key: 'ArrowRight',
			bubbles: true,
			cancelable: true,
		}));

		expect(document.activeElement).toBe(charts);
		expect(onChange).not.toHaveBeenCalled();
		expect(preview.getAttribute('aria-selected')).toBe('true');

		charts.dispatchEvent(new KeyboardEvent('keydown', {
			key: 'Enter',
			bubbles: true,
			cancelable: true,
		}));
		expect(onChange).toHaveBeenCalledWith({ activeTab: 'charts' });
	});

	it('supports Home, End, and Space without activating on focus movement', async () => {
		const { updateTabs } = await import('../../../../src/features/datasetWorkspace/views/tabsView.js');
		const onChange = vi.fn();
		updateTabs('charts', onChange);

		const charts = document.getElementById('tab-charts');
		charts.focus();
		charts.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
		expect(document.activeElement).toBe(document.getElementById('tab-panel'));
		document.getElementById('tab-panel').dispatchEvent(new KeyboardEvent('keydown', {
			key: 'Home',
			bubbles: true,
		}));
		expect(document.activeElement).toBe(document.getElementById('tab-preview'));
		expect(onChange).not.toHaveBeenCalled();

		document.getElementById('tab-preview').dispatchEvent(new KeyboardEvent('keydown', {
			key: ' ',
			bubbles: true,
			cancelable: true,
		}));
		expect(onChange).toHaveBeenCalledWith({ activeTab: 'preview' });
	});

	it('registers listeners once and always uses latest callback', async () => {
		const { updateTabs } = await import('../../../../src/features/datasetWorkspace/views/tabsView.js');
		const firstCallback = vi.fn();
		const latestCallback = vi.fn();

		updateTabs('preview', firstCallback);
		updateTabs('preview', latestCallback);
		updateTabs('preview', latestCallback);

		document.getElementById('tab-charts').click();

		expect(firstCallback).not.toHaveBeenCalled();
		expect(latestCallback).toHaveBeenCalledTimes(1);
		expect(latestCallback).toHaveBeenCalledWith({ activeTab: 'charts' });
	});

	it('does nothing on click when callback is missing', async () => {
		const { updateTabs } = await import('../../../../src/features/datasetWorkspace/views/tabsView.js');

		updateTabs('preview');

		expect(() => {
			document.getElementById('tab-preview').click();
			document.getElementById('tab-charts').click();
			document.getElementById('tab-panel').click();
		}).not.toThrow();
	});

	it('shows global filter trigger on preview and hides it on panel', async () => {
		const { updateTabs } = await import('../../../../src/features/datasetWorkspace/views/tabsView.js');

		updateTabs('preview', vi.fn(), null, {
			triggerState: { hasDataset: true, globalFilter: { column: null }, filteredCount: 0, totalCount: 0 },
		});

		const trigger = document.getElementById('btn-global-filter');
		expect(trigger.hidden).toBe(false);

		updateTabs('panel', vi.fn(), null, {
			triggerState: { hasDataset: true, globalFilter: { column: null }, filteredCount: 0, totalCount: 0 },
		});

		expect(trigger.hidden).toBe(true);
	});

	it('shows disabled trigger on charts tab with no dataset', async () => {
		const { updateTabs } = await import('../../../../src/features/datasetWorkspace/views/tabsView.js');

		updateTabs('charts', vi.fn(), null, {
			triggerState: { hasDataset: false, globalFilter: null, filteredCount: 0, totalCount: 0 },
		});

		const trigger = document.getElementById('btn-global-filter');
		expect(trigger.hidden).toBe(false);
		expect(trigger.disabled).toBe(true);
	});

	it('renders active indicator with rule count and X/Y when rules exist', async () => {
		const { updateTabs } = await import('../../../../src/features/datasetWorkspace/views/tabsView.js');

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
		const badge = document.getElementById('global-filter-trigger-badge');
		expect(trigger.hidden).toBe(false);
		expect(trigger.disabled).toBe(false);
		expect(trigger.dataset.active).toBe('true');
		expect(label.textContent).toBe('Filter on • 2 rules · 7/20');
		expect(badge.hidden).toBe(false);
		expect(badge.textContent).toBe('2');
	});

	it('hides badge when no rules are active on charts tab', async () => {
		const { updateTabs } = await import('../../../../src/features/datasetWorkspace/views/tabsView.js');

		updateTabs('charts', vi.fn(), null, {
			triggerState: {
				hasDataset: true,
				globalFilter: { rules: [] },
				filteredCount: 20,
				totalCount: 20,
			},
		});

		const badge = document.getElementById('global-filter-trigger-badge');
		expect(badge.hidden).toBe(true);
		expect(badge.textContent).toBe('');
	});

	it('renders neutral label when there are no rules', async () => {
		const { updateTabs } = await import('../../../../src/features/datasetWorkspace/views/tabsView.js');

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
		const { updateTabs } = await import('../../../../src/features/datasetWorkspace/views/tabsView.js');
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

	it('synchronizes aria-expanded for the lifetime of the filter dialog promise', async () => {
		const { updateTabs } = await import('../../../../src/features/datasetWorkspace/views/tabsView.js');
		let closeDialog;
		const onOpen = vi.fn(() => new Promise(resolve => {
			closeDialog = resolve;
		}));

		updateTabs('preview', vi.fn(), null, {
			onGlobalFilterOpen: onOpen,
			triggerState: {
				hasDataset: true,
				globalFilter: { rules: [] },
				filteredCount: 10,
				totalCount: 10,
			},
		});

		const trigger = document.getElementById('btn-global-filter');
		trigger.click();
		expect(trigger.getAttribute('aria-expanded')).toBe('true');
		trigger.click();
		expect(onOpen).toHaveBeenCalledTimes(1);

		closeDialog();
		await Promise.resolve();
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
	});
});
