// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import {
	appendRenderBudgetNotice,
	approveFullRender,
	hasFullRenderApproval,
} from '../../../src/charts/shared/renderBudget.js';

describe('chart render budgets', () => {
	it('keeps approvals scoped to one container and chart type', () => {
		const first = document.createElement('div');
		const second = document.createElement('div');

		approveFullRender(first, 'scatter');

		expect(hasFullRenderApproval(first, 'scatter')).toBe(true);
		expect(hasFullRenderApproval(first, 'network')).toBe(false);
		expect(hasFullRenderApproval(second, 'scatter')).toBe(false);
	});

	it('builds one actionable status notice', () => {
		const container = document.createElement('div');
		const onApprove = vi.fn();

		appendRenderBudgetNotice(container, {
			message: 'Showing a sample',
			actionLabel: 'Render all',
			onApprove,
			blocked: true,
		});
		appendRenderBudgetNotice(container, {
			message: 'Updated',
			actionLabel: 'Continue',
			onApprove,
		});

		expect(container.querySelectorAll('.chart-render-budget-notice')).toHaveLength(1);
		expect(container.querySelector('[role="status"]').textContent).toContain('Updated');
		container.querySelector('button').click();
		container.querySelector('button').click();
		expect(onApprove).toHaveBeenCalledTimes(1);
	});
});
