// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { renderNetworkGraph } from '../../../src/modules/visualizations/networkGraph.js';

describe('network graph visualization', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="network"></div>';
	});

	it('renders links and nodes from source/target columns', () => {
		const container = document.getElementById('network');
		const dados = [
			{ origem: 'A', destino: 'B', peso: 2 },
			{ origem: 'B', destino: 'C', peso: 1 },
			{ origem: 'A', destino: 'C', peso: 3 },
		];

		const result = renderNetworkGraph(container, dados, 'origem', 'destino', {
			weightColumn: 'peso',
			showNodeLabels: true,
		});

		expect(result.ok).toBe(true);
		expect(result.nodesCount).toBe(3);
		expect(result.linksCount).toBe(3);
		expect(container.querySelectorAll('line').length).toBe(3);
		expect(container.querySelectorAll('circle').length).toBe(3);
	});

	it('uses configured source/target labels in the legend', () => {
		const container = document.getElementById('network');
		const dados = [
			{ origem: 'A', destino: 'B' },
			{ origem: 'B', destino: 'C' },
		];

		renderNetworkGraph(container, dados, 'origem', 'destino', {
			showLegend: true,
			labels: { source: 'Origem', target: 'Destino' },
		});

		const legendTexts = Array.from(container.querySelectorAll('.network-legend text'))
			.map(node => node.textContent);
		expect(legendTexts).toContain('Origem');
		expect(legendTexts).toContain('Destino');
		expect(legendTexts).not.toContain('Source');
		expect(legendTexts).not.toContain('Target');
	});

	it('falls back to "Source" / "Target" when labels are absent', () => {
		const container = document.getElementById('network');
		const dados = [
			{ origem: 'A', destino: 'B' },
			{ origem: 'B', destino: 'C' },
		];

		renderNetworkGraph(container, dados, 'origem', 'destino', { showLegend: true });

		const legendTexts = Array.from(container.querySelectorAll('.network-legend text'))
			.map(node => node.textContent);
		expect(legendTexts).toContain('Source');
		expect(legendTexts).toContain('Target');
	});

	it('returns explicit failure when there is no valid source-target data', () => {
		const container = document.getElementById('network');
		const dados = [
			{ origem: '', destino: '' },
			{ origem: null, destino: undefined },
		];

		const result = renderNetworkGraph(container, dados, 'origem', 'destino');

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('insufficient-data');
	});
});
