// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('tooltip', () => {
	let showChartTooltip, hideChartTooltip, moveChartTooltip;

	beforeEach(async () => {
		document.body.innerHTML = '';
		// Re-import to reset the module-level tooltipEl
		vi.resetModules();
		const mod = await import('../../../src/modules/visualizations/tooltip.js');
		showChartTooltip = mod.showChartTooltip;
		hideChartTooltip = mod.hideChartTooltip;
		moveChartTooltip = mod.moveChartTooltip;
	});

	it('creates tooltip element on first show and displays text content', () => {
		showChartTooltip('Hello', 100, 200);
		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip).not.toBeNull();
		expect(tooltip.textContent).toBe('Hello');
		expect(tooltip.style.display).toBe('block');
	});

	it('positions tooltip with offset', () => {
		showChartTooltip('Test', 50, 60);
		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip.style.left).toBe('62px');
		expect(tooltip.style.top).toBe('72px');
	});

	it('hides tooltip', () => {
		showChartTooltip('Visible', 0, 0);
		hideChartTooltip();
		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip.style.display).toBe('none');
	});

	it('moves tooltip to new position', () => {
		showChartTooltip('Move me', 0, 0);
		moveChartTooltip(200, 300);
		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip.style.left).toBe('212px');
		expect(tooltip.style.top).toBe('312px');
	});

	it('accepts Node content instead of string', () => {
		const span = document.createElement('span');
		span.textContent = 'Rich content';
		showChartTooltip(span, 10, 10);
		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip.querySelector('span')?.textContent).toBe('Rich content');
	});

	it('handles null/undefined content gracefully', () => {
		showChartTooltip(null, 0, 0);
		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip.textContent).toBe('');
	});

	it('reuses existing tooltip element', () => {
		showChartTooltip('First', 0, 0);
		showChartTooltip('Second', 0, 0);
		const tooltips = document.querySelectorAll('.chart-tooltip');
		expect(tooltips.length).toBe(1);
		expect(tooltips[0].textContent).toBe('Second');
	});
});
