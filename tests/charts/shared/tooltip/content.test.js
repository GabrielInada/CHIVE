// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import {
	buildPinnedShell,
	createFilterStateBadge,
	createNamedActionGroup,
	createTooltipActionGroup,
	createTooltipLine,
} from '../../../../src/charts/shared/tooltip/content.js';

describe('tooltip/content builders (standalone, no overlay singleton)', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('createTooltipLine renders a label/value row with textContent', () => {
		const row = createTooltipLine('Sales', '1,200');
		expect(row.querySelector('strong').textContent).toBe('Sales:');
		expect(row.textContent).toBe('Sales: 1,200');
	});

	it('createTooltipActionGroup builds buttons, skips empty labels, and honors disabled/danger', () => {
		let clicked = 0;
		const group = createTooltipActionGroup([
			{ label: 'Add', onClick: () => { clicked += 1; } },
			{ label: '   ', onClick: () => {} },
			{ label: 'Hide', variant: 'danger', onClick: () => {} },
			{ label: 'Off', disabled: true, onClick: () => { clicked += 1; } },
		]);
		const buttons = group.querySelectorAll('button.chart-tooltip__action');
		expect(buttons).toHaveLength(3);
		expect(group.getAttribute('role')).toBe('group');
		expect(buttons[1].classList.contains('chart-tooltip__action--danger')).toBe(true);
		expect(buttons[2].disabled).toBe(true);

		buttons[0].click();
		buttons[2].click();
		expect(clicked).toBe(1);
	});

	it('buildPinnedShell composes header + content + badge + divided action sets', () => {
		const content = createTooltipLine('Region', 'West');
		const badge = createFilterStateBadge({ state: 'included' });
		const actions = createNamedActionGroup([{ label: 'Add', onClick: () => {} }], 'Filter');
		const shell = buildPinnedShell({
			headerTitle: 'Region',
			content,
			actionSets: [actions],
			stateBadge: badge,
			closeLabel: 'Close',
			onDismiss: () => {},
		});

		expect(shell.querySelector('.chart-tooltip__header-title').textContent).toBe('Region');
		expect(shell.querySelector('button.chart-tooltip__close')).not.toBeNull();
		expect(shell.querySelector('.chart-tooltip__filter-state--included')).not.toBeNull();
		expect(shell.querySelector('.chart-tooltip__divider')).not.toBeNull();
		expect(shell.querySelector('.chart-tooltip__action-set-label').textContent).toBe('Filter');
	});

	it('createFilterStateBadge returns null for a non-filter state', () => {
		expect(createFilterStateBadge({ state: null })).toBeNull();
	});

	it('uses no overlay singleton: building content appends nothing to the body', () => {
		createTooltipLine('A', 'B');
		createTooltipActionGroup([{ label: 'X', onClick: () => {} }]);
		buildPinnedShell({ headerTitle: 'T', content: 'body' });
		createFilterStateBadge({ state: 'excluded' });
		expect(document.querySelector('.chart-tooltip')).toBeNull();
		expect(document.body.children).toHaveLength(0);
	});
});
