// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../src/i18n/en.json';
import ptBR from '../../../src/i18n/pt-BR.json';
import { CHART_DEFINITIONS } from '../../../src/config/charts/definitions.js';
import { getPanelChartRenderer } from '../../../src/charts/registries/panel.js';
import { hideChartTooltip } from '../../../src/charts/shared/tooltip/tooltip.js';

const locale = vi.hoisted(() => ({ value: 'pt-BR' }));
const messages = { en, 'pt-BR': ptBR };

vi.mock('../../../src/services/i18nService.js', () => ({
	t: key => messages[locale.value][key] || key,
	getLocale: () => locale.value,
}));

const rows = [
	{ team: 'A', group: 'North', sales: 10, profit: 4, source: 'A', target: 'B' },
	{ team: 'B', group: 'North', sales: 20, profit: 6, source: 'B', target: 'C' },
];
const columns = [
	{ name: 'team', type: 'text' },
	{ name: 'sales', type: 'number' },
	{ name: 'profit', type: 'number' },
];
const cases = [
	['bar', { category: 'team' }, 'rect'],
	['pie', { category: 'team' }, 'path'],
	['treemap', { category: 'team' }, 'rect'],
	['bubble', { category: 'team' }, '.bubble-node'],
	['bubble', { category: 'team', nestingMode: 'grouped', nestingColumns: ['group'] }, '.bubble-parent'],
	['network', { source: 'source', target: 'target' }, '.network-node'],
	['scatter', { x: 'team', y: 'sales' }, '.scatter-point'],
	['scatter', { x: 'sales', y: 'profit' }, '.scatter-point'],
];

describe.each(['pt-BR', 'en'])('Panel tooltip labels in %s', language => {
	let container;

	beforeEach(() => {
		locale.value = language;
		document.body.innerHTML = '<div id="chart"></div>';
		container = document.getElementById('chart');
	});

	afterEach(() => {
		hideChartTooltip();
		container.__chive_network_simulation__?.stop();
	});

	it.each(cases)('localizes the close button on %s %j without filter actions', (type, config, selector) => {
		const render = getPanelChartRenderer(type);
		const result = render(container, {
			type,
			config: { ...CHART_DEFINITIONS[type].createDefaultConfig(), ...config },
			dataSnapshot: rows,
			columnsSnapshot: columns,
		});
		expect(result.ok).toBe(true);
		const mark = container.querySelector(selector);
		expect(mark).not.toBeNull();
		mark.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 100, clientY: 100 }));

		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip.hidden).toBe(false);
		expect(tooltip.classList.contains('chart-tooltip--fixado')).toBe(true);
		const close = tooltip.querySelector('.chart-tooltip__close');
		const expected = language === 'pt-BR' ? 'Fechar' : 'Close';
		expect(close.getAttribute('aria-label')).toBe(expected);
		expect(close.title).toBe(expected);
		expect(tooltip.querySelector('.chart-tooltip__action')).toBeNull();
		expect(tooltip.querySelector('.chart-tooltip__filter-state')).toBeNull();
		close.click();
		expect(tooltip.hidden).toBe(true);
	});
});
