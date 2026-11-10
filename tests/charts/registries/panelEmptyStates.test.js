// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../src/i18n/en.json';
import ptBR from '../../../src/i18n/pt-BR.json';
import { CHART_DEFINITIONS } from '../../../src/config/charts/definitions.js';
import { renderWorkspaceChart } from '../../../src/charts/registries/workspace.js';
import { CHART_BLOCKS, CHART_CONTAINERS } from '../../../src/charts/workspaceDomIds.js';
import { mountSlot, teardownAllSlots } from '../../../src/features/panel/slots/lifecycle.js';
import { CHART_DISPOSE_HOOK } from '../../../src/charts/shared/containerLifecycle.js';

const locale = vi.hoisted(() => ({ value: 'en' }));
const catalogs = { en, 'pt-BR': ptBR };
vi.mock('../../../src/services/i18nService.js', () => ({
	t: key => catalogs[locale.value][key] || key,
	getLocale: () => locale.value,
}));

const rows = [{ category: 'A', value: -1, x: -1, y: 2, z: 3 }];
const columnTypeByName = { category: 'text', value: 'number', x: 'number', y: 'number', z: 'number' };
const columnsSnapshot = Object.entries(columnTypeByName).map(([name, type]) => ({ name, type }));
const svgTypes = ['bar', 'line', 'scatter', 'pie', 'bubble', 'network', 'treemap', 'tin'];
const cases = svgTypes.map(type => [type, {}, [], undefined, 'chive-chart-empty-' + type]);
for (const type of ['bar', 'pie', 'bubble', 'treemap']) {
	const numericKey = 'chive-chart-empty-' + type + (type === 'pie' ? '-sum' : '-numeric');
	cases.push([type, { category: 'category', measureMode: 'sum' }, rows, 'no-value-column', numericKey]);
	cases.push([type, { category: 'category', measureMode: 'sum', valueColumn: 'value' }, [{ category: 'A', value: null }], 'no-numeric', numericKey]);
	if (type !== 'bar') cases.push([type, { category: 'category', measureMode: 'sum', valueColumn: 'value' }, rows, 'no-positive-value', 'chive-chart-empty-no-positive-sum']);
}
cases.push(
	['line', { x: 'x', y: 'y' }, [{ x: null, y: 1 }], 'no-x-values', 'chive-chart-empty-line-x'],
	['line', { x: 'x', y: 'y' }, [{ x: 1, y: null }], 'no-numeric', 'chive-chart-empty-line-numeric'],
	['scatter', { x: 'x', y: 'y', xScale: 'log' }, rows, 'log-no-positive', 'chive-chart-empty-scatter-log'],
	['bubble', { category: 'category', nestingMode: 'grouped', nestingColumns: [] }, rows, 'no-nesting-columns', 'chive-chart-empty-bubble-nesting-required'],
	['tin', { x: 'x', y: 'y', z: 'z' }, rows, 'insufficient-points', 'chive-chart-empty-tin-insufficient-points'],
);

describe.each(['en', 'pt-BR'])('workspace and Panel empty states in %s', language => {
	beforeEach(() => {
		locale.value = language;
		document.body.replaceChildren();
	});
	afterEach(() => {
		teardownAllSlots(document.body);
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it.each(cases)('%s with %j shows the same message on both surfaces', (type, overrides, dataSnapshot, reason, messageKey) => {
		const config = { ...CHART_DEFINITIONS[type].createDefaultConfig(), ...overrides, enabled: true };
		const block = document.createElement('div');
		block.id = CHART_BLOCKS[type];
		const workspace = document.createElement('div');
		workspace.id = CHART_CONTAINERS[type];
		block.append(workspace);
		document.body.append(block);
		renderWorkspaceChart(type, { config, rows: dataSnapshot, columnTypeByName, filterCallbacks: {} });
		expect(workspace.querySelector('.chart-empty')?.textContent).toBe(catalogs[language][messageKey]);

		const spec = { id: 1, type, config, dataSnapshot, columnsSnapshot };
		const before = structuredClone(spec);
		for (const className of ['panel-item-preview', 'panel-chart-container']) {
			const panel = document.createElement('div');
			panel.className = className;
			document.body.append(panel);
			panel.append(document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
			const dispose = vi.fn();
			panel[CHART_DISPOSE_HOOK] = dispose;
			const result = mountSlot(panel, spec);
			expect(result.ok).toBe(false);
			if (reason) expect(result.reason).toBe(reason);
			expect(panel.querySelector('.chart-empty')?.textContent).toBe(workspace.textContent);
			expect(panel.querySelectorAll('.chart-empty')).toHaveLength(1);
			expect(panel.querySelector('svg')).toBeNull();
			expect(dispose).toHaveBeenCalledOnce();
		}
		expect(spec).toEqual(before);
	});

	it('retains the message after resize and replaces it when a drawable capture is mounted', () => {
		let resize;
		let frame;
		vi.stubGlobal('ResizeObserver', class {
			constructor(callback) { resize = callback; }
			observe() {}
			disconnect() {}
		});
		vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frame = callback; return 1; });
		vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
		const panel = document.createElement('div');
		panel.className = 'panel-chart-container';
		document.body.append(panel);
		const spec = {
			id: 1, type: 'pie', columnsSnapshot, dataSnapshot: rows,
			config: { ...CHART_DEFINITIONS.pie.createDefaultConfig(), category: 'category', measureMode: 'sum', valueColumn: 'value' },
		};
		mountSlot(panel, spec);
		resize();
		frame();
		expect(panel.querySelectorAll('.chart-empty')).toHaveLength(1);
		expect(panel.textContent).toBe(catalogs[language]['chive-chart-empty-no-positive-sum']);
		mountSlot(panel, { ...spec, dataSnapshot: [{ category: 'A', value: 1 }] });
		expect(panel.querySelector('svg')).not.toBeNull();
		expect(panel.querySelector('.chart-empty')).toBeNull();
		mountSlot(panel, spec);
		expect(panel.querySelector('svg')).toBeNull();
		expect(panel.textContent).toBe(catalogs[language]['chive-chart-empty-no-positive-sum']);
	});
});
