// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../src/i18n/en.json';
import { CHART_DEFINITIONS } from '../../../../src/config/charts/definitions.js';
import { getPanelChartRenderer } from '../../../../src/charts/registries/panel.js';
import { hideChartTooltip } from '../../../../src/charts/shared/tooltip/tooltip.js';

vi.mock('../../../../src/services/i18nService.js', () => ({
	t: key => en[key] || key,
	getLocale: () => 'en',
}));

const rows = [
	{ team: 'A', group: 'North', x: 1, y: 2, z: 3, source: 'A', target: 'B' },
	{ team: 'B', group: 'South', x: 3, y: 4, z: 5, source: 'B', target: 'C' },
	{ team: 'C', group: 'North', x: 1, y: 5, z: 7, source: 'C', target: 'A' },
];
const columns = [
	{ name: 'team', type: 'text' },
	{ name: 'x', type: 'number' },
	{ name: 'y', type: 'number' },
	{ name: 'z', type: 'number' },
];
const cases = [
	['bar', { category: 'team' }, 'rect'],
	['pie', { category: 'team' }, 'path'],
	['treemap', { category: 'team' }, 'rect'],
	['bubble', { category: 'team' }, '.bubble-node'],
	['bubble', { category: 'team', nestingMode: 'grouped', nestingColumns: ['group'] }, '.bubble-parent'],
	['network', { source: 'source', target: 'target' }, '.network-node'],
	['scatter', { x: 'team', y: 'y' }, '.scatter-point'],
	['scatter', { x: 'x', y: 'y' }, '.scatter-point'],
];

describe('chart marks hand pin identity to the shared tooltip', () => {
	let slots;
	const tooltip = () => document.querySelector('.chart-tooltip');
	const event = (target, type) => target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: 100, clientY: 100 }));
	const hover = target => {
		for (const type of ['mouseenter', 'mouseover', 'mousemove', 'mouseleave', 'mouseout', 'pointerover', 'pointerout']) event(target, type);
	};
	const draw = (container, type, config) => {
		const result = getPanelChartRenderer(type)(container, {
			type,
			config: { ...CHART_DEFINITIONS[type].createDefaultConfig(), ...config },
			dataSnapshot: rows,
			columnsSnapshot: columns,
		});
		expect(result.ok).toBe(true);
		container.__chive_network_simulation__?.stop();
	};

	beforeEach(() => {
		document.body.innerHTML = '<div id="first-slot"></div><div id="second-slot"></div>';
		slots = [...document.querySelectorAll('div')];
	});
	afterEach(() => {
		hideChartTooltip();
		for (const slot of slots) slot.__chive_network_simulation__?.stop();
	});

	it.each(cases)('%s %j distinguishes marks and identical categories in separate Panel slots', (type, config, selector) => {
		for (const slot of slots) draw(slot, type, config);
		const [first, second] = slots[0].querySelectorAll(selector);
		const sameInOtherSlot = slots[1].querySelector(selector);
		event(first, 'click');
		const firstContent = tooltip().textContent;
		hover(second);
		hover(sameInOtherSlot);
		expect(tooltip().hidden).toBe(false);
		expect(tooltip().textContent).toBe(firstContent);
		event(second, 'click');
		expect(tooltip().textContent).not.toBe(firstContent);
		event(first, 'click');
		event(sameInOtherSlot, 'click');
		expect(tooltip().hidden).toBe(false);
		expect(tooltip().textContent).toBe(firstContent);
		event(sameInOtherSlot, 'click');
		expect(tooltip().hidden).toBe(true);
		event(first, 'click');
		expect(tooltip().hidden).toBe(false);
		expect(tooltip().querySelector('.chart-tooltip__action')).toBeNull();
	});

	it.each([
		['line', { x: 'x', y: 'y', showPoints: true }, 'circle'],
		['tin', { x: 'x', y: 'y', z: 'z', showPoints: true, showIsolines: true, subdivisionDepth: 0 }, 'circle, .tin-isoline-hit'],
		['scatter', { x: 'x', y: 'y', regression: { enabled: true } }, '.scatter-regression-line'],
	])('%s hover does not overwrite or dismiss a different chart pin', (type, config, selector) => {
		draw(slots[0], 'bar', { category: 'team' });
		draw(slots[1], type, config);
		event(slots[0].querySelector('rect'), 'click');
		const content = tooltip().textContent;
		const marks = slots[1].querySelectorAll(selector);
		expect(marks.length).toBeGreaterThan(0);
		for (const mark of marks) hover(mark);
		expect(tooltip().hidden).toBe(false);
		expect(tooltip().textContent).toBe(content);
	});
});
