// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { renderBubbleChart } from '../../../../src/charts/bubble/renderers/svg.js';

describe('bubble chart multi-level nesting', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="bubble"></div>';
	});

	it('nestingColumns length 1 matches current grouped behavior', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A', grupo: 'X' },
			{ categoria: 'B', grupo: 'X' },
			{ categoria: 'C', grupo: 'Y' },
		];

		const result = renderBubbleChart(container, rows, 'categoria', {
			nestingMode: 'grouped',
			nestingColumns: ['grupo'],
		});

		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('g.bubble-parent').length).toBe(2);
		expect(container.querySelectorAll('g.bubble-node').length).toBe(3);
	});

	it('nestingColumns length 2 creates two intermediate depths plus leaves', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A', regiao: 'Norte', estado: 'PA' },
			{ categoria: 'B', regiao: 'Norte', estado: 'PA' },
			{ categoria: 'C', regiao: 'Norte', estado: 'AM' },
			{ categoria: 'D', regiao: 'Sul', estado: 'RS' },
		];

		const result = renderBubbleChart(container, rows, 'categoria', {
			nestingMode: 'grouped',
			nestingColumns: ['regiao', 'estado'],
		});

		expect(result.ok).toBe(true);
		// Depth 1: Norte, Sul = 2 parents
		// Depth 2: PA, AM, RS = 3 parents
		// Total intermediate: 5
		expect(container.querySelectorAll('g.bubble-parent').length).toBe(5);
		expect(container.querySelectorAll('g.bubble-node').length).toBe(4);

		// Check depth attributes
		const depth1 = container.querySelectorAll('g.bubble-parent[data-depth="1"]');
		const depth2 = container.querySelectorAll('g.bubble-parent[data-depth="2"]');
		expect(depth1.length).toBe(2);
		expect(depth2.length).toBe(3);
	});

	it('nestingColumns length 3 creates expected depth chain', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A', continente: 'America', pais: 'Brasil', regiao: 'Norte' },
			{ categoria: 'B', continente: 'America', pais: 'Brasil', regiao: 'Sul' },
			{ categoria: 'C', continente: 'Europa', pais: 'Portugal', regiao: 'Lisboa' },
		];

		const result = renderBubbleChart(container, rows, 'categoria', {
			nestingMode: 'grouped',
			nestingColumns: ['continente', 'pais', 'regiao'],
		});

		expect(result.ok).toBe(true);
		const depth1 = container.querySelectorAll('g.bubble-parent[data-depth="1"]');
		const depth2 = container.querySelectorAll('g.bubble-parent[data-depth="2"]');
		const depth3 = container.querySelectorAll('g.bubble-parent[data-depth="3"]');
		expect(depth1.length).toBe(2); // America, Europa
		expect(depth2.length).toBe(2); // Brasil, Portugal
		expect(depth3.length).toBe(3); // Norte, Sul, Lisboa
		expect(container.querySelectorAll('g.bubble-node').length).toBe(3);
	});

	it('grouped with only groupColumn still works (migration)', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A', grupo: 'X' },
			{ categoria: 'B', grupo: 'Y' },
		];

		const result = renderBubbleChart(container, rows, 'categoria', {
			nestingMode: 'grouped',
			groupColumn: 'grupo',
		});

		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('g.bubble-parent').length).toBe(2);
	});

	it('grouped with both nestingColumns and groupColumn prefers nestingColumns', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A', regiao: 'Norte', grupo: 'X' },
			{ categoria: 'B', regiao: 'Sul', grupo: 'Y' },
		];

		const result = renderBubbleChart(container, rows, 'categoria', {
			nestingMode: 'grouped',
			nestingColumns: ['regiao'],
			groupColumn: 'grupo',
		});

		expect(result.ok).toBe(true);
		// Should group by 'regiao', not 'grupo'
		const parents = container.querySelectorAll('g.bubble-parent');
		expect(parents.length).toBe(2);
	});

	it('null values in nesting columns normalized and rendered', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A', grupo: null },
			{ categoria: 'B', grupo: 'X' },
		];

		const result = renderBubbleChart(container, rows, 'categoria', {
			nestingMode: 'grouped',
			nestingColumns: ['grupo'],
		});

		expect(result.ok).toBe(true);
		// Two groups: 'N/A' and 'X'
		expect(container.querySelectorAll('g.bubble-parent').length).toBe(2);
	});

	it('single-item groups render and zoom without errors', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A', grupo: 'X' },
		];

		const result = renderBubbleChart(container, rows, 'categoria', {
			nestingMode: 'grouped',
			nestingColumns: ['grupo'],
			zoomTransitionDuration: 0,
		});

		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('g.bubble-parent').length).toBe(1);
		expect(container.querySelectorAll('g.bubble-node').length).toBe(1);
	});

	it('empty grouped nesting returns no-nesting-columns fail reason', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A' },
		];

		const result = renderBubbleChart(container, rows, 'categoria', {
			nestingMode: 'grouped',
			nestingColumns: [],
		});

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('no-nesting-columns');
	});

	it('grouped mode with an invalid truthy groupColumn fails instead of rendering flat', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A', grupo: 'X' },
			{ categoria: 'B', grupo: 'Y' },
		];

		for (const badGroup of [{}, 1, true]) {
			container.innerHTML = '';
			const result = renderBubbleChart(container, rows, 'categoria', {
				nestingMode: 'grouped',
				groupColumn: badGroup,
			});
			expect(result.ok).toBe(false);
			expect(result.reason).toBe('no-nesting-columns');
			expect(container.querySelectorAll('g.bubble-node').length).toBe(0);
		}

		// A valid string groupColumn in the same setup still resolves and renders grouped.
		container.innerHTML = '';
		const ok = renderBubbleChart(container, rows, 'categoria', {
			nestingMode: 'grouped',
			groupColumn: 'grupo',
		});
		expect(ok.ok).toBe(true);
		expect(container.querySelectorAll('g.bubble-parent').length).toBe(2);
	});

	it('intermediate nodes rendered for all depths', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A', regiao: 'Norte', estado: 'PA' },
			{ categoria: 'B', regiao: 'Sul', estado: 'RS' },
		];

		const result = renderBubbleChart(container, rows, 'categoria', {
			nestingMode: 'grouped',
			nestingColumns: ['regiao', 'estado'],
		});

		expect(result.ok).toBe(true);
		const allParents = container.querySelectorAll('g.bubble-parent');
		// 2 regions + 2 states = 4 intermediate nodes
		expect(allParents.length).toBe(4);
	});
});
