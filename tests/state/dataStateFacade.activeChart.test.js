import { describe, expect, it, vi } from 'vitest';
import { createDataStateFacade } from '../../src/state/dataStateFacade.js';
import { CHART_TYPE_KEYS } from '../../src/config/charts/definitions.js';

function makeFacade(initialConfig = null) {
	const emitStateChange = vi.fn();
	const dataset = {
		id: 'ds-1',
		rows: [{}],
		columns: [],
		chartConfig: initialConfig || {
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
		expect(dataset.chartConfig.bar.enabled).toBe(true);
		CHART_TYPE_KEYS.filter(t => t !== 'bar').forEach(type => {
			expect(dataset.chartConfig[type].enabled).toBe(false);
		});
	});

	it('switches active cleanly from one chart to another', () => {
		const { facade, dataset } = makeFacade();
		facade.setActiveChartType('bar');
		facade.setActiveChartType('scatter');
		expect(dataset.chartConfig.bar.enabled).toBe(false);
		expect(dataset.chartConfig.scatter.enabled).toBe(true);
		CHART_TYPE_KEYS.filter(t => t !== 'scatter').forEach(type => {
			expect(dataset.chartConfig[type].enabled).toBe(false);
		});
	});

	it('activates scatter3d (the type list gate accepts it)', () => {
		const { facade, dataset } = makeFacade();
		facade.setActiveChartType('scatter3d');
		expect(dataset.chartConfig.scatter3d.enabled).toBe(true);
		CHART_TYPE_KEYS.filter(t => t !== 'scatter3d').forEach(type => {
			expect(dataset.chartConfig[type].enabled).toBe(false);
		});
	});

	it('disables all charts when called with null', () => {
		const { facade, dataset } = makeFacade();
		facade.setActiveChartType('pie');
		facade.setActiveChartType(null);
		CHART_TYPE_KEYS.forEach(type => {
			expect(dataset.chartConfig[type].enabled).toBe(false);
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
		expect(dataset.chartConfig.bubble.enabled).toBe(true);
		expect(dataset.chartConfig.bar.enabled).toBe(false);
		expect(dataset.chartConfig.scatter.enabled).toBe(false);
		expect(dataset.chartConfig.pie.enabled).toBe(false);
	});

	it('merges activatedOverrides into the activated chart config', () => {
		const { facade, dataset } = makeFacade();
		facade.setActiveChartType('bar', { category: 'newCol', expanded: true });
		expect(dataset.chartConfig.bar.enabled).toBe(true);
		expect(dataset.chartConfig.bar.category).toBe('newCol');
		expect(dataset.chartConfig.bar.expanded).toBe(true);
	});

	it('ignores activatedOverrides when chartType is null', () => {
		const { facade, dataset } = makeFacade();
		facade.setActiveChartType(null, { category: 'shouldNotApply' });
		expect(dataset.chartConfig.bar.category).toBe('col1');
		expect(dataset.chartConfig.bar.enabled).toBe(false);
	});

	it('is a no-op for unknown chart types', () => {
		const { facade, emitStateChange, dataset } = makeFacade();
		const before = JSON.stringify(dataset.chartConfig);
		facade.setActiveChartType('histogram');
		expect(JSON.stringify(dataset.chartConfig)).toBe(before);
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

	it('canonicalizes the config: fills every default block including line and tin', () => {
		const { facade, dataset } = makeFacade();
		facade.setActiveChartType('bar');
		// Every supported block exists and is default-filled after canonicalization.
		CHART_TYPE_KEYS.forEach(type => {
			expect(dataset.chartConfig[type]).toBeDefined();
		});
		expect(dataset.chartConfig.bar.sort).toBeDefined();
		expect(dataset.chartConfig.line.curve).toBeDefined();
		expect(dataset.chartConfig.tin).toBeDefined();
		expect(dataset.chartConfig.globalFilter).toEqual({ rules: [], combine: 'AND' });
	});

	it('repairs malformed existing chart blocks before toggling a chart type', () => {
		const { facade, dataset } = makeFacade({
			bar: 'bad',
			scatter: { enabled: false },
		});

		facade.setActiveChartType('bar');

		expect(dataset.chartConfig.bar.enabled).toBe(true);
		expect(dataset.chartConfig.bar.sort).toBeDefined();
		expect(dataset.chartConfig.bar).not.toHaveProperty('0');
		expect(dataset.chartConfig.bar).not.toHaveProperty('1');
		expect(dataset.chartConfig.bar).not.toHaveProperty('2');
	});

	it('ignores malformed activatedOverrides instead of spreading index keys', () => {
		const { facade, dataset } = makeFacade();

		facade.setActiveChartType('bar', ['bad']);

		expect(dataset.chartConfig.bar.enabled).toBe(true);
		expect(dataset.chartConfig.bar.category).toBe('col1');
		expect(dataset.chartConfig.bar).not.toHaveProperty('0');
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
		expect(dataset.chartConfig.bar.category).toBe('a');
		expect(dataset.chartConfig.bar.color).toBe('#abc');
		expect(dataset.chartConfig.scatter.x).toBe('x1');
		expect(dataset.chartConfig.scatter.y).toBe('y1');
	});
});
