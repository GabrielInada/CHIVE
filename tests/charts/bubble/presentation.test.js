// @vitest-environment jsdom

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ptBR from '../../../src/i18n/pt-BR.json';
import { CHART_DEFINITIONS } from '../../../src/config/charts/definitions.js';
import { renderBubbleInto } from '../../../src/charts/bubble/presentation.js';
import { hideChartTooltip } from '../../../src/charts/shared/tooltip/tooltip.js';

vi.mock('../../../src/services/i18nService.js', () => ({
	t: key => ptBR[key] ?? key,
	getLocale: () => 'pt-BR',
}));

let container;
beforeEach(() => {
	document.body.innerHTML = '<div id="chart"></div>';
	container = document.getElementById('chart');
});
afterEach(() => hideChartTooltip());

function draw(rows, overrides = {}, columnTypeByName = {}) {
	const config = Object.freeze({ ...CHART_DEFINITIONS.bubble.createDefaultConfig(), category: 'team', ...overrides });
	return renderBubbleInto(container, { rows, config, columnTypeByName });
}

it('draws stored nesting and mean settings with translated group and measure labels', () => {
	const result = draw([
		{ team: 'North', group: 'G1', sales: 10 },
		{ team: 'North', group: 'G1', sales: 20 },
		{ team: 'South', group: 'G2', sales: 5 },
	], {
		nestingMode: 'grouped', nestingColumns: Object.freeze(['group']),
		measureMode: 'mean', valueColumn: 'sales', topN: 0, labelMode: 'all',
		padding: 5, colorScheme: 'Pastel', chartHeight: 450, customTitle: 'Resultados',
	});
	expect(result.ok).toBe(true);
	expect(container.querySelector('svg').getAttribute('height')).toBe('450');
	expect(container.querySelectorAll('.bubble-parent')).toHaveLength(2);
	expect(container.querySelectorAll('.bubble-node')).toHaveLength(2);
	expect(container.textContent).toContain('Resultados');
	const north = [...container.querySelectorAll('.bubble-node')].find(node => node.__data__.data.label === 'North');
	expect(north.querySelector('title').textContent).toContain('Média: 15');
	expect(north.querySelector('title').textContent).toContain('G1');
	for (const circle of container.querySelectorAll('.bubble-node circle')) {
		expect(Number(circle.getAttribute('r'))).toBeGreaterThan(0);
	}
});

it('explains a grouped chart without nesting columns', () => {
	const result = draw([{ team: 'North' }], { nestingMode: 'grouped', nestingColumns: [], groupColumn: null });
	expect(result).toMatchObject({ ok: false, reason: 'no-nesting-columns' });
	expect(container.textContent).toBe(ptBR['chive-chart-empty-bubble-nesting-required']);
});
