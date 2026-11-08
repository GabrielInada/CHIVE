// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../src/i18n/en.json';
import ptBR from '../../../src/i18n/pt-BR.json';
import { CHART_DEFINITIONS } from '../../../src/config/charts/definitions.js';
import { renderBarInto } from '../../../src/charts/bar/presentation.js';
import { renderPieInto } from '../../../src/charts/pie/presentation.js';
import { renderTreemapInto } from '../../../src/charts/treemap/presentation.js';
import { renderBubbleInto } from '../../../src/charts/bubble/presentation.js';
import { renderNetworkInto } from '../../../src/charts/network/presentation.js';
import { renderScatterInto } from '../../../src/charts/scatter/presentation.js';
import { hideChartTooltip } from '../../../src/charts/shared/tooltip/tooltip.js';

const locale = vi.hoisted(() => ({ value: 'en' }));
const catalogs = { en, 'pt-BR': ptBR };
vi.mock('../../../src/services/i18nService.js', () => ({
	t: key => catalogs[locale.value][key] ?? key,
	getLocale: () => locale.value,
}));

const rows = [
	{ team: 'A', sales: 12.5, source: 'A', target: 'B' },
	{ team: 'B', sales: 20, source: 'B', target: 'C' },
];
const cases = [
	['bar', renderBarInto, { category: 'team' }, 'rect'],
	['pie', renderPieInto, { category: 'team' }, 'path'],
	['treemap', renderTreemapInto, { category: 'team' }, 'rect'],
	['bubble', renderBubbleInto, { category: 'team' }, '.bubble-node'],
	['network', renderNetworkInto, { source: 'source', target: 'target' }, '.network-node'],
	['scatter', renderScatterInto, { x: 'team', y: 'sales' }, '.scatter-point'],
];

describe.each(['en', 'pt-BR'])('presentation-owned tooltip labels in %s', language => {
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

	it.each(cases)('%s labels its filter actions without text supplied by a surface', (type, render, overrides, selector) => {
		const calls = [];
		const callbacks = Object.freeze({
			onFocusGlobalFilter: (column, token) => calls.push([column, token]),
			onAddToGlobalFilter: () => {},
			onExcludeGlobalFilter: () => {},
		});
		const config = Object.freeze({ ...CHART_DEFINITIONS[type].createDefaultConfig(), ...overrides });
		const result = render(container, {
			rows, config, columnTypeByName: { team: 'text', sales: 'number' }, filterCallbacks: callbacks,
		});
		expect(result.ok).toBe(true);
		container.querySelector(selector).dispatchEvent(new MouseEvent('click', { bubbles: true }));

		const tooltip = document.querySelector('.chart-tooltip');
		const buttons = [...tooltip.querySelectorAll('.chart-tooltip__action')];
		const messages = catalogs[language];
		expect(buttons.slice(0, 3).map(button => button.textContent)).toEqual([
			messages['chive-tooltip-show-only-this'],
			messages['chive-tooltip-add-to-filter'],
			messages['chive-tooltip-exclude'],
		]);
		expect(tooltip.querySelector('.chart-tooltip__close').getAttribute('aria-label'))
			.toBe(messages['chive-tooltip-close']);
		if (type === 'network') {
			expect([...tooltip.querySelectorAll('.chart-tooltip__action-set-label')].map(node => node.textContent))
				.toEqual([
					`${messages['chive-tooltip-filter-by-source']} (source)`,
					`${messages['chive-tooltip-filter-by-target']} (target)`,
				]);
		}
		buttons[0].click();
		expect(calls).toEqual([[type === 'network' ? 'source' : 'team', 'v:A']]);
	});

	it.each(['included', 'excluded'])('labels the %s badge and its action', state => {
		renderBarInto(container, {
			rows,
			config: { ...CHART_DEFINITIONS.bar.createDefaultConfig(), category: 'team' },
			filterCallbacks: {
				getTokenFilterState: () => state,
				onRemoveFromGlobalFilter: () => {},
				onBringBackGlobalFilter: () => {},
			},
		});
		container.querySelector('rect').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const messages = catalogs[language];
		expect(document.querySelector('.chart-tooltip__filter-state').textContent)
			.toContain(messages[`chive-tooltip-state-${state}`]);
		expect(document.querySelector('.chart-tooltip__action').textContent)
			.toBe(messages[state === 'included' ? 'chive-tooltip-remove-from-filter' : 'chive-tooltip-bring-back']);
	});
});
