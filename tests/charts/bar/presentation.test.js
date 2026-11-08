// @vitest-environment jsdom

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ptBR from '../../../src/i18n/pt-BR.json';
import { CHART_DEFINITIONS } from '../../../src/config/charts/definitions.js';
import { renderBarInto } from '../../../src/charts/bar/presentation.js';
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
	const config = Object.freeze({ ...CHART_DEFINITIONS.bar.createDefaultConfig(), category: 'team', ...overrides });
	return renderBarInto(container, { rows, config, columnTypeByName });
}

it('draws stored measure, sort, title and color settings with translated labels', () => {
	const result = draw([
		{ team: 'North', sales: 10 }, { team: 'North', sales: 20 }, { team: 'South', sales: 5 },
	], {
		measureMode: 'mean', valueColumn: 'sales', topN: 1, sort: 'count-desc',
		customTitle: 'Resultados', chartHeight: 300, color: '#123456', showXAxisLabel: false,
	});
	expect(result.ok).toBe(true);
	expect(container.querySelector('svg').getAttribute('height')).toBe('300');
	const bars = [...container.querySelectorAll('rect')];
	expect(bars).toHaveLength(1);
	expect(bars[0].getAttribute('fill')).toBe('#123456');
	expect(container.textContent).toContain('Resultados');
	expect(container.textContent).not.toContain('team');
	expect(container.querySelector('text[transform="rotate(-90)"]').textContent).toBe('Média');
	bars[0].dispatchEvent(new MouseEvent('mouseenter'));
	expect(document.querySelector('.chart-tooltip').textContent).toContain('Média: 15');
});

it('replaces a drawing with the translated numeric empty state', () => {
	draw([{ team: 'North', sales: 10 }]);
	const result = draw([{ team: 'North', sales: 'none' }], { measureMode: 'sum', valueColumn: 'sales' });
	expect(result).toMatchObject({ ok: false, reason: 'no-numeric' });
	expect(container.querySelector('svg')).toBeNull();
	expect(container.textContent).toBe(ptBR['chive-chart-empty-bar-numeric']);
});
