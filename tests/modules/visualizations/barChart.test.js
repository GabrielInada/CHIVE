// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderBarChart } from '../../../src/modules/visualizations/barChart.js';
import { hideChartTooltip } from '../../../src/modules/visualizations/tooltip.js';

function textValues(container) {
	return Array.from(container.querySelectorAll('text')).map(node => node.textContent);
}

describe('renderBarChart scaffold', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="bar"></div>';
	});

	afterEach(() => {
		hideChartTooltip();
	});

	it('renders SVG dimensions, top-N bars, title, and axis labels', () => {
		const container = document.getElementById('bar');
		const rows = [
			{ category: 'A' },
			{ category: 'A' },
			{ category: 'A' },
			{ category: 'B' },
			{ category: 'B' },
			{ category: 'C' },
		];

		const result = renderBarChart(container, rows, 'category', {
			topN: 2,
			customTitle: 'Top categories',
			axisLabels: { x: 'Category label', y: 'Count label' },
			chartHeight: 260,
		});

		expect(result.ok).toBe(true);
		const svg = container.querySelector('svg');
		expect(svg.getAttribute('width')).toBe('700');
		expect(svg.getAttribute('height')).toBe('260');
		expect(container.querySelectorAll('rect')).toHaveLength(2);
		expect(textValues(container)).toEqual(expect.arrayContaining([
			'Top categories',
			'Category label',
			'Count label',
		]));
	});

	it('does not apply the title offset when no custom title is set', () => {
		const container = document.getElementById('bar');
		const result = renderBarChart(container, [{ category: 'A' }], 'category');

		expect(result.ok).toBe(true);
		expect(container.querySelector('svg > g').getAttribute('transform')).toBe('translate(52,12)');
	});
});
