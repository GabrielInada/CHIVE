import { describe, expect, it, vi } from 'vitest';
import { createDataStateFacade } from '../../src/modules/state/dataStateFacade.js';

const CHART_TYPES = ['bar', 'scatter', 'pie', 'bubble', 'network', 'treemap'];

function makeFacade(initialConfig = null) {
	const emitStateChange = vi.fn();
	const dataset = {
		id: 'ds-1',
		dados: [{}],
		colunas: [],
		configGraficos: initialConfig || {
			bar: { enabled: false, category: 'col1' },
			scatter: { enabled: false },
			pie: { enabled: false },
			bubble: { enabled: false },
			network: { enabled: false },
			treemap: { enabled: false },
		},
	};
	const appState = {
		data: { datasets: [dataset], activeIndex: 0 },
		panel: { charts: [], slots: {} },
		ui: {},
	};
	const facade = createDataStateFacade({ appState, emitStateChange });
	return { facade, emitStateChange, dataset };
}

describe('dataStateFacade.setActiveChartType', () => {
	it('enables exactly one chart and disables the rest', () => {
		const { facade, dataset } = makeFacade();
		facade.setActiveChartType('bar');
		expect(dataset.configGraficos.bar.enabled).toBe(true);
		CHART_TYPES.filter(t => t !== 'bar').forEach(type => {
			expect(dataset.configGraficos[type].enabled).toBe(false);
		});
	});

	it('switches active cleanly from one chart to another', () => {
		const { facade, dataset } = makeFacade();
		facade.setActiveChartType('bar');
		facade.setActiveChartType('scatter');
		expect(dataset.configGraficos.bar.enabled).toBe(false);
		expect(dataset.configGraficos.scatter.enabled).toBe(true);
		CHART_TYPES.filter(t => t !== 'scatter').forEach(type => {
			expect(dataset.configGraficos[type].enabled).toBe(false);
		});
	});

	it('disables all charts when called with null', () => {
		const { facade, dataset } = makeFacade();
		facade.setActiveChartType('pie');
		facade.setActiveChartType(null);
		CHART_TYPES.forEach(type => {
			expect(dataset.configGraficos[type].enabled).toBe(false);
		});
	});

	it('reconciles legacy multi-enabled configs to a single active type', () => {
		const { facade, dataset } = makeFacade({
			bar: { enabled: true },
			scatter: { enabled: true },
			pie: { enabled: true },
			bubble: { enabled: false },
			network: { enabled: false },
			treemap: { enabled: false },
		});
		facade.setActiveChartType('bubble');
		expect(dataset.configGraficos.bubble.enabled).toBe(true);
		expect(dataset.configGraficos.bar.enabled).toBe(false);
		expect(dataset.configGraficos.scatter.enabled).toBe(false);
		expect(dataset.configGraficos.pie.enabled).toBe(false);
	});

	it('merges activatedOverrides into the activated chart config', () => {
		const { facade, dataset } = makeFacade();
		facade.setActiveChartType('bar', { category: 'newCol', expanded: true });
		expect(dataset.configGraficos.bar.enabled).toBe(true);
		expect(dataset.configGraficos.bar.category).toBe('newCol');
		expect(dataset.configGraficos.bar.expanded).toBe(true);
	});

	it('ignores activatedOverrides when chartType is null', () => {
		const { facade, dataset } = makeFacade();
		facade.setActiveChartType(null, { category: 'shouldNotApply' });
		expect(dataset.configGraficos.bar.category).toBe('col1');
		expect(dataset.configGraficos.bar.enabled).toBe(false);
	});

	it('is a no-op for unknown chart types', () => {
		const { facade, emitStateChange, dataset } = makeFacade();
		const before = JSON.stringify(dataset.configGraficos);
		facade.setActiveChartType('histogram');
		expect(JSON.stringify(dataset.configGraficos)).toBe(before);
		expect(emitStateChange).not.toHaveBeenCalled();
	});

	it('is a no-op when there is no active dataset', () => {
		const emitStateChange = vi.fn();
		const appState = {
			data: { datasets: [], activeIndex: -1 },
			panel: { charts: [], slots: {} },
			ui: {},
		};
		const facade = createDataStateFacade({ appState, emitStateChange });
		facade.setActiveChartType('bar');
		expect(emitStateChange).not.toHaveBeenCalled();
	});

	it('emits exactly one CONFIG_UPDATED event per call', () => {
		const { facade, emitStateChange } = makeFacade();
		facade.setActiveChartType('scatter');
		expect(emitStateChange).toHaveBeenCalledTimes(1);
		expect(emitStateChange).toHaveBeenCalledWith('configUpdated', { activeChartType: 'scatter' });
	});

	it('preserves non-enabled fields of other chart types when switching', () => {
		const { facade, dataset } = makeFacade({
			bar: { enabled: true, category: 'a', color: '#abc' },
			scatter: { enabled: false, x: 'x1', y: 'y1' },
			pie: { enabled: false },
			bubble: { enabled: false },
			network: { enabled: false },
			treemap: { enabled: false },
		});
		facade.setActiveChartType('scatter');
		expect(dataset.configGraficos.bar.category).toBe('a');
		expect(dataset.configGraficos.bar.color).toBe('#abc');
		expect(dataset.configGraficos.scatter.x).toBe('x1');
		expect(dataset.configGraficos.scatter.y).toBe('y1');
	});
});
