// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../src/i18n/en.json';
import ptBR from '../../../src/i18n/pt-BR.json';
import { BUBBLE_DEFINITION } from '../../../src/config/charts/definitions/bubble.js';
import { renderWorkspaceChart } from '../../../src/charts/registries/workspace.js';
import { CHART_BLOCKS, CHART_CONTAINERS } from '../../../src/charts/workspaceDomIds.js';

const locale = vi.hoisted(() => ({ value: 'en' }));
const catalogs = { en, 'pt-BR': ptBR };
vi.mock('../../../src/services/i18nService.js', () => ({
	t: key => catalogs[locale.value][key] || key,
	getLocale: () => locale.value,
}));

const rows = [
	{ team: 'North', returns: -4, net: 4, group: 'North' },
	{ team: 'North', returns: -6, net: -10, group: 'North' },
	{ team: 'South', returns: -5, net: 9, group: 'South' },
	{ team: 'East', returns: 0, net: 1, group: 'South' },
];

describe.each(['en', 'pt-BR'])('bubble empty states in %s', language => {
	let container;
	beforeEach(() => {
		locale.value = language;
		document.body.replaceChildren();
		const block = document.createElement('div');
		block.id = CHART_BLOCKS.bubble;
		container = document.createElement('div');
		container.id = CHART_CONTAINERS.bubble;
		block.append(container);
		document.body.append(block);
	});

	it.each([
		['sum', 'flat'], ['sum', 'grouped'], ['mean', 'flat'], ['mean', 'grouped'],
	])('replaces the chart with a message for non-positive %s in %s mode', (measureMode, nestingMode) => {
		const config = {
			...BUBBLE_DEFINITION.createDefaultConfig(), enabled: true, category: 'team',
			measureMode, nestingMode, nestingColumns: ['group'], valueColumn: 'net',
		};
		renderWorkspaceChart('bubble', { config, rows, filterCallbacks: {} });
		const circles = Array.from(container.querySelectorAll('g.bubble-node > circle'));
		expect(circles).toHaveLength(2);
		for (const circle of circles) {
			expect(Number.isFinite(Number(circle.getAttribute('r')))).toBe(true);
			expect(Number(circle.getAttribute('r'))).toBeGreaterThan(0);
		}

		renderWorkspaceChart('bubble', { config: { ...config, valueColumn: 'returns' }, rows, filterCallbacks: {} });
		expect(container.querySelector('svg')).toBeNull();
		expect(container.querySelector('.chart-empty')?.textContent)
			.toBe(catalogs[language]['chive-chart-empty-no-positive-sum']);

		renderWorkspaceChart('bubble', { config: { ...config, measureMode: 'count' }, rows, filterCallbacks: {} });
		expect(container.querySelector('.chart-empty')).toBeNull();
		expect(container.querySelectorAll('g.bubble-node')).toHaveLength(3);
	});
});
