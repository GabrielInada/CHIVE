// @vitest-environment jsdom

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ptBR from '../../../src/i18n/pt-BR.json';
import { CHART_DEFINITIONS } from '../../../src/config/charts/definitions.js';
import { renderLineInto } from '../../../src/charts/line/presentation.js';
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
	const config = Object.freeze({ ...CHART_DEFINITIONS.line.createDefaultConfig(), x: 'month', y: 'sales', ...overrides });
	return renderLineInto(container, { rows, config, columnTypeByName });
}

it('uses stored curve, aggregation and stroke settings with the supplied date column type', () => {
	const result = draw([
		{ month: '2024-01-01', sales: 10 },
		{ month: '2024-01-01', sales: 20 },
		{ month: '2024-02-01', sales: 30 },
	], {
		aggregateMode: 'mean', curve: 'linear', showPoints: true, sortX: true,
		strokeWidth: 4, color: '#123456', showYAxisLabel: false, chartHeight: 300,
		customTitle: 'Resultados',
	}, { month: 'date', sales: 'number' });
	expect(result.ok).toBe(true);
	const line = container.querySelector('.line-path-main');
	expect(line.getAttribute('stroke')).toBe('#123456');
	expect(line.getAttribute('stroke-width')).toBe('4');
	const points = [...container.querySelectorAll('.line-point')];
	expect(points.map(node => node.__data__.y)).toEqual([15, 30]);
	expect(points.every(node => node.__data__.x instanceof Date)).toBe(true);
	expect(container.querySelector('svg').getAttribute('height')).toBe('300');
	expect(container.querySelector('text[transform="rotate(-90)"]')).toBeNull();
	expect(container.textContent).toContain('Resultados');
	points[0].dispatchEvent(new MouseEvent('mouseenter'));
	expect(document.querySelector('.chart-tooltip').textContent).toContain('sales: 15');
});

it('shows the translated failure for a selected column without numeric values', () => {
	const result = draw([{ month: 'January', sales: 'none' }]);
	expect(result).toMatchObject({ ok: false, reason: 'no-numeric' });
	expect(container.textContent).toBe(ptBR['chive-chart-empty-line-numeric']);
});
