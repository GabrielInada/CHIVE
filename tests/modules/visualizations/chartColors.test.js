// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { renderBarChart } from '../../../src/modules/visualizations/barChart.js';
import { renderScatterPlot } from '../../../src/modules/visualizations/scatterPlot.js';
import { CHART_COLORS } from '../../../src/config/index.js';

describe('visualization color options', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="bar"></div><div id="scatter"></div>';
	});

	it('applies custom bar color to rendered bars', () => {
		const container = document.getElementById('bar');
		const dados = [
			{ categoria: 'A' },
			{ categoria: 'B' },
			{ categoria: 'A' },
		];

		const result = renderBarChart(container, dados, 'categoria', {
			color: '#112233',
		});

		expect(result.ok).toBe(true);
		const rect = container.querySelector('rect');
		expect(rect).not.toBeNull();
		expect(rect.getAttribute('fill')).toBe('#112233');
	});

	it('falls back to default bar color on invalid color', () => {
		const container = document.getElementById('bar');
		const dados = [{ categoria: 'A' }];

		renderBarChart(container, dados, 'categoria', {
			color: 'invalid-color',
		});

		const rect = container.querySelector('rect');
		expect(rect.getAttribute('fill')).toBe(CHART_COLORS.bar);
	});

	it('applies custom scatter color to rendered points', () => {
		const container = document.getElementById('scatter');
		const dados = [
			{ x: 1, y: 2 },
			{ x: 2, y: 3 },
			{ x: 3, y: 4 },
		];

		const result = renderScatterPlot(container, dados, 'x', 'y', {
			color: '#abcdef',
		});

		expect(result.ok).toBe(true);
		const circle = container.querySelector('circle');
		expect(circle).not.toBeNull();
		expect(circle.getAttribute('fill')).toBe('#abcdef');
	});
});
