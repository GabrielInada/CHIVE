// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { renderBarChart } from '../../../src/modules/visualizations/barChart.js';
import { renderPieChart } from '../../../src/modules/visualizations/pieChart.js';
import { renderScatterPlot } from '../../../src/modules/visualizations/scatterPlot.js';

describe('pie chart and axis labels', () => {
	beforeEach(() => {
		document.body.innerHTML = [
			'<div id="bar"></div>',
			'<div id="scatter"></div>',
			'<div id="pie"></div>',
		].join('');
	});

	it('renders pie chart with valid defaults and custom color base', () => {
		const container = document.getElementById('pie');
		const dados = [
			{ categoria: 'A' },
			{ categoria: 'B' },
			{ categoria: 'A' },
			{ categoria: 'C' },
		];

		const result = renderPieChart(container, dados, 'categoria', {
			color: '#336699',
			innerRadius: 24,
			outerRadius: 80,
		});

		expect(result.ok).toBe(true);
		const slices = container.querySelectorAll('path');
		expect(slices.length).toBeGreaterThan(0);
		expect(slices[0].getAttribute('fill')).toBe('#336699');
	});

	it('supports pie sum mode with legend and outside labels', () => {
		const container = document.getElementById('pie');
		const dados = [
			{ categoria: 'A', valor: 10 },
			{ categoria: 'A', valor: 5 },
			{ categoria: 'B', valor: 7 },
			{ categoria: 'C', valor: 3 },
		];

		const result = renderPieChart(container, dados, 'categoria', {
			measureMode: 'sum',
			valueColumn: 'valor',
			showLegend: true,
			labelPosition: 'outside',
			padAngle: 4,
		});

		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('polyline').length).toBeGreaterThan(0);
		expect(container.textContent).toContain('A (15)');
	});

	it('applies initial zoom scale to pie viewport', () => {
		const container = document.getElementById('pie');
		const dados = [
			{ categoria: 'A' },
			{ categoria: 'B' },
			{ categoria: 'A' },
		];

		const result = renderPieChart(container, dados, 'categoria', {
			zoomScale: 1.8,
		});

		expect(result.ok).toBe(true);
		const svg = container.querySelector('svg');
		const viewport = svg?.querySelector('g');
		expect(viewport?.getAttribute('transform') || '').toContain('scale(1.8)');
	});

	it('hides outside labels for tiny slices while keeping legend entries visible', () => {
		const container = document.getElementById('pie');
		const dados = [];
		for (let index = 0; index < 98; index += 1) {
			dados.push({ categoria: 'Major' });
		}
		dados.push({ categoria: 'TinyA' });
		dados.push({ categoria: 'TinyB' });

		const result = renderPieChart(container, dados, 'categoria', {
			labelPosition: 'outside',
			showLegend: true,
		});

		expect(result.ok).toBe(true);
		const outsideLabels = Array.from(container.querySelectorAll('text.pie-outside-label')).map(node => node.textContent);
		expect(outsideLabels.join(' ')).not.toContain('TinyA');
		expect(outsideLabels.join(' ')).not.toContain('TinyB');
		expect(container.textContent).toContain('TinyA (1)');
		expect(container.textContent).toContain('TinyB (1)');
	});

	it('returns explicit failure reason for sum mode without valid numeric column', () => {
		const container = document.getElementById('pie');
		const dados = [
			{ categoria: 'A', valor: 'x' },
			{ categoria: 'B', valor: 'y' },
		];

		const result = renderPieChart(container, dados, 'categoria', {
			measureMode: 'sum',
			valueColumn: 'valor',
		});

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('sum-no-numeric');
	});

	it('supports bar chart sum and mean measure modes with numeric value column', () => {
		const container = document.getElementById('bar');
		const dados = [
			{ categoria: 'A', valor: 10 },
			{ categoria: 'A', valor: 20 },
			{ categoria: 'B', valor: 30 },
		];

		const sumResult = renderBarChart(container, dados, 'categoria', {
			measureMode: 'sum',
			valueColumn: 'valor',
		});
		expect(sumResult.ok).toBe(true);

		const meanResult = renderBarChart(container, dados, 'categoria', {
			measureMode: 'mean',
			valueColumn: 'valor',
		});
		expect(meanResult.ok).toBe(true);
	});

	it('returns explicit failure reasons for bar sum/mean when value column is missing or non-numeric', () => {
		const container = document.getElementById('bar');
		const dados = [
			{ categoria: 'A', valor: 'x' },
			{ categoria: 'B', valor: 'y' },
		];

		const noColumnResult = renderBarChart(container, dados, 'categoria', {
			measureMode: 'sum',
			valueColumn: 'inexistente',
		});
		expect(noColumnResult.ok).toBe(false);
		expect(noColumnResult.reason).toBe('no-value-column');

		const noNumericResult = renderBarChart(container, dados, 'categoria', {
			measureMode: 'sum',
			valueColumn: 'valor',
		});
		expect(noNumericResult.ok).toBe(false);
		expect(noNumericResult.reason).toBe('no-numeric');
	});

	it('supports toggling axis labels in bar and scatter charts', () => {
		const barContainer = document.getElementById('bar');
		const scatterContainer = document.getElementById('scatter');

		const barData = [
			{ categoria: 'A' },
			{ categoria: 'A' },
			{ categoria: 'B' },
		];
		const scatterData = [
			{ x: 1, y: 2 },
			{ x: 3, y: 4 },
			{ x: 5, y: 6 },
		];

		renderBarChart(barContainer, barData, 'categoria', {
			showXAxisLabel: true,
			showYAxisLabel: false,
			axisLabels: {
				x: 'Bar Axis X Custom',
				y: 'Bar Axis Y Custom',
			},
		});
		expect(barContainer.textContent).toContain('Bar Axis X Custom');
		expect(barContainer.textContent).not.toContain('Bar Axis Y Custom');

		renderScatterPlot(scatterContainer, scatterData, 'x', 'y', {
			showXAxisLabel: false,
			showYAxisLabel: true,
			axisLabels: {
				x: 'Scatter Axis X Custom',
				y: 'Scatter Axis Y Custom',
			},
		});
		expect(scatterContainer.textContent).not.toContain('Scatter Axis X Custom');
		expect(scatterContainer.textContent).toContain('Scatter Axis Y Custom');
	});
});
