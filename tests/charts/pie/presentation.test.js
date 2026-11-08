// @vitest-environment jsdom

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ptBR from '../../../src/i18n/pt-BR.json';
import { CHART_DEFINITIONS } from '../../../src/config/charts/definitions.js';
import { MISSING_TOKEN } from '../../../src/domain/datasets/cellValues.js';
import { renderPieInto } from '../../../src/charts/pie/presentation.js';
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
	const config = Object.freeze({ ...CHART_DEFINITIONS.pie.createDefaultConfig(), category: 'team', ...overrides });
	return renderPieInto(container, { rows, config, columnTypeByName });
}

it('draws a configured donut with custom colors, outside labels and translated Other', () => {
	const result = draw([
		{ team: 'North', sales: 10 }, { team: 'North', sales: 20 }, { team: 'South', sales: 5 },
	], {
		measureMode: 'sum', valueColumn: 'sales', topN: 1, topNMode: 'other',
		customTitle: 'Resultados', chartHeight: 300, innerRadius: 30, outerRadius: 80,
		labelPosition: 'outside', padAngle: 4, zoomScale: 1.2,
		customSliceColors: Object.freeze({ North: '#123456' }),
	});
	expect(result.ok).toBe(true);
	expect(container.querySelector('svg').getAttribute('height')).toBe('300');
	const slices = [...container.querySelectorAll('path')];
	expect(slices).toHaveLength(2);
	expect(slices[0].getAttribute('fill')).toBe('#123456');
	expect(container.querySelector('svg > g').getAttribute('transform')).toContain('scale(1.2)');
	expect(container.querySelector('polyline')).not.toBeNull();
	expect(container.textContent).toContain('Resultados');
	expect(container.textContent).toContain(ptBR['chive-chart-pie-other']);
	slices[0].dispatchEvent(new MouseEvent('mouseenter'));
	expect(document.querySelector('.chart-tooltip').textContent).toContain('Soma: 30');
});

it('translates the missing bucket and keeps its filter token', () => {
	draw([{ team: null }, { team: 'North' }], { topN: 0 });
	const slice = [...container.querySelectorAll('path')].find(node => node.__data__.data.token === MISSING_TOKEN);
	expect(slice).toBeDefined();
	expect(slice.__data__.data.label).toBe(ptBR['chive-chart-filter-missing']);
});

it('shows the translated empty state when no positive sum remains', () => {
	const result = draw([{ team: 'North', sales: -1 }], { measureMode: 'sum', valueColumn: 'sales' });
	expect(result).toMatchObject({ ok: false, reason: 'no-positive-value' });
	expect(container.textContent).toBe(ptBR['chive-chart-empty-no-positive-sum']);
});
