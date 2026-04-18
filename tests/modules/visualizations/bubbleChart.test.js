// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { renderBubbleChart } from '../../../src/modules/visualizations/bubbleChart.js';

describe('bubble chart visualization', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="bubble"></div>';
	});

	it('returns failure when container or category column is missing', () => {
		const dados = [{ categoria: 'A' }];

		expect(renderBubbleChart(null, dados, 'categoria')).toEqual({ ok: false });
		expect(renderBubbleChart(document.getElementById('bubble'), dados, null)).toEqual({ ok: false });
	});

	it('renders packed bubbles and returns ok', () => {
		const container = document.getElementById('bubble');
		const dados = [
			{ categoria: 'A' },
			{ categoria: 'A' },
			{ categoria: 'B' },
			{ categoria: 'C' },
		];

		const result = renderBubbleChart(container, dados, 'categoria', {
			chartHeight: 700,
			labelMode: 'auto',
		});

		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('g.bubble-node > circle').length).toBe(3);
		expect(container.querySelectorAll('g.bubble-node').length).toBe(3);
	});

	it('supports count, sum, and mean aggregation plus top-N filtering', () => {
		const container = document.getElementById('bubble');
		const dados = [
			{ categoria: 'A', valor: 10 },
			{ categoria: 'A', valor: 20 },
			{ categoria: 'B', valor: 5 },
			{ categoria: 'C', valor: 40 },
		];

		const countResult = renderBubbleChart(container, dados, 'categoria', { topN: 2 });
		expect(countResult.ok).toBe(true);
		expect(container.querySelectorAll('g.bubble-node').length).toBe(2);

		container.innerHTML = '';
		const sumResult = renderBubbleChart(container, dados, 'categoria', {
			measureMode: 'sum',
			valueColumn: 'valor',
			topN: 0,
		});
		expect(sumResult.ok).toBe(true);
		expect(container.querySelectorAll('g.bubble-node').length).toBe(3);

		container.innerHTML = '';
		const meanResult = renderBubbleChart(container, dados, 'categoria', {
			measureMode: 'mean',
			valueColumn: 'valor',
		});
		expect(meanResult.ok).toBe(true);
	});

	it('returns explicit failure reasons for missing numeric data in sum mode', () => {
		const container = document.getElementById('bubble');
		const dados = [
			{ categoria: 'A', valor: 'x' },
			{ categoria: 'B', valor: 'y' },
		];

		const result = renderBubbleChart(container, dados, 'categoria', {
			measureMode: 'sum',
			valueColumn: 'valor',
		});

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('no-numeric');
	});
});