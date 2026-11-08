// @vitest-environment jsdom

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ptBR from '../../../src/i18n/pt-BR.json';
import { CHART_DEFINITIONS } from '../../../src/config/charts/definitions.js';
import { renderTreemapInto } from '../../../src/charts/treemap/presentation.js';
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
	const config = Object.freeze({ ...CHART_DEFINITIONS.treemap.createDefaultConfig(), category: 'team', ...overrides });
	return renderTreemapInto(container, { rows, config, columnTypeByName });
}

it('draws stored Top-N, colors and label visibility with translated measure text', () => {
	const result = draw([
		{ team: 'North', sales: 10 }, { team: 'North', sales: 20 }, { team: 'South', sales: 5 },
	], {
		measureMode: 'sum', valueColumn: 'sales', topN: 1, padding: 4,
		colorMode: 'uniform', color: '#123456', showLabels: false, showValues: false,
		customTitle: 'Resultados', chartHeight: 300,
	});
	expect(result.ok).toBe(true);
	const tiles = [...container.querySelectorAll('rect')];
	expect(tiles).toHaveLength(1);
	expect(tiles[0].getAttribute('fill')).toBe('#123456');
	expect(container.querySelector('svg').getAttribute('height')).toBe('300');
	expect(container.textContent).toBe('Resultados');
	tiles[0].dispatchEvent(new MouseEvent('mouseenter'));
	expect(document.querySelector('.chart-tooltip').textContent).toContain('Soma: 30');
});

it('shows the translated empty state when no positive mean remains', () => {
	const result = draw([{ team: 'North', sales: -1 }], { measureMode: 'mean', valueColumn: 'sales' });
	expect(result).toMatchObject({ ok: false, reason: 'no-positive-value' });
	expect(container.textContent).toBe(ptBR['chive-chart-empty-no-positive-sum']);
});
