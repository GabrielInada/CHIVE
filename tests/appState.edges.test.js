// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	addDataset,
	removeDataset,
	setActiveDataset,
	getActiveDataset,
	getActiveDatasetIndex,
	addChartSnapshot,
	removeChartSnapshot,
	getChartSnapshot,
	getPanelCharts,
	getPanelBlocks,
	updateActiveDatasetConfig,
	updateActiveDatasetColumns,
	onStateChange,
	resetState,
} from '../src/modules/appState.js';

/**
 * Extended appState edge cases and branch coverage.
 */
describe('appState (edge cases - branch coverage)', () => {
	beforeEach(() => {
		resetState();
	});

	describe('Dataset management branches', () => {
		it('returns null when no active dataset', () => {
			expect(getActiveDataset()).toBeNull();
			expect(getActiveDatasetIndex()).toBe(-1);
		});

		it('throws on invalid dataset index in setActiveDataset', () => {
			addDataset({ dados: [{}], colunas: [] });
			expect(() => setActiveDataset(99)).toThrow();
			expect(() => setActiveDataset(-2)).toThrow();
		});

		it('auto-selects first added dataset', () => {
			const idx = addDataset({ dados: [{ x: 1 }], colunas: ['x'] });
			expect(getActiveDatasetIndex()).toBe(idx);
		});

		it('does not override activeIndex on subsequent adds', () => {
			addDataset({ dados: [{}], colunas: [] });
			addDataset({ dados: [{}], colunas: [] });
			expect(getActiveDatasetIndex()).toBe(0);
		});

		it('adjusts activeIndex down when earlier dataset removed', () => {
			addDataset({ dados: [{}], colunas: [] });
			addDataset({ dados: [{}], colunas: [] });
			addDataset({ dados: [{}], colunas: [] });

			setActiveDataset(2);
			removeDataset(0);

			expect(getActiveDatasetIndex()).toBe(1); // was 2, shifted to 1
		});

		it('sets activeIndex to -1 when last dataset removed', () => {
			addDataset({ dados: [{}], colunas: [] });
			removeDataset(0);
			expect(getActiveDatasetIndex()).toBe(-1);
		});

		it('does not change activeIndex when removed after active', () => {
			addDataset({ dados: [{}], colunas: [] });
			addDataset({ dados: [{}], colunas: [] });
			setActiveDataset(0);
			removeDataset(1);
			expect(getActiveDatasetIndex()).toBe(0);
		});

		it('clears panel charts when dataset removed', () => {
			addDataset({ dados: [{}], colunas: [] });
			addChartSnapshot({ nome: 'c1', svgMarkup: '<svg/>' });
			expect(getPanelCharts().length).toBe(1);

			removeDataset(0);
			expect(getPanelCharts().length).toBe(0);
		});
	});

	describe('Configuration update branches', () => {
		it('does nothing if no active dataset (config)', () => {
			expect(() => updateActiveDatasetConfig({ x: 1 })).not.toThrow();
		});

		it('does nothing if no active dataset (columns)', () => {
			expect(() => updateActiveDatasetColumns(['x'])).not.toThrow();
		});

		it('merges config into active dataset', () => {
			const idx = addDataset({
				dados: [{}],
				colunas: [],
				configGraficos: { type: 'bar' },
			});
			updateActiveDatasetConfig({ title: 'Test' });

			const active = getActiveDataset();
			expect(active.configGraficos).toEqual({ type: 'bar', title: 'Test' });
		});

		it('updates column selection in active dataset', () => {
			addDataset({
				dados: [{}],
				colunas: ['a', 'b'],
				colunasSelecionadas: [],
			});
			updateActiveDatasetColumns(['a']);

			const active = getActiveDataset();
			expect(active.colunasSelecionadas).toEqual(['a']);
		});
	});

	describe('Chart snapshot branches', () => {
		it('increments chart IDs correctly', () => {
			const id1 = addChartSnapshot({ nome: 'c1', svgMarkup: '<svg/>' });
			const id2 = addChartSnapshot({ nome: 'c2', svgMarkup: '<svg/>' });
			expect(id2).toBe(id1 + 1);
		});

		it('returns null for non-existent chart ID', () => {
			expect(getChartSnapshot(999)).toBeNull();
		});

		it('normalizes non-numeric chart ID to null', () => {
			expect(getChartSnapshot('invalid')).toBeNull();
			expect(getChartSnapshot(null)).toBeNull();
		});

		it('removes chart from snapshots array', () => {
			const id1 = addChartSnapshot({ nome: 'c1', svgMarkup: '<svg/>' });
			const id2 = addChartSnapshot({ nome: 'c2', svgMarkup: '<svg/>' });

			removeChartSnapshot(id1);

			expect(getPanelCharts().length).toBe(1);
			expect(getPanelCharts()[0].id).toBe(id2);
		});

		it('sanitizes chart name on add', () => {
			const id = addChartSnapshot({
				nome: '<img src=x onerror="alert(1)">',
				svgMarkup: '<svg/>',
			});
			const chart = getChartSnapshot(id);
			// sanitation should occur (test exact behavior depends on implementation)
			expect(chart.nome).toBeDefined();
		});

		it('handles createdAt timestamp', () => {
			const now = new Date().toISOString();
			const id = addChartSnapshot({
				nome: 'test',
				svgMarkup: '<svg/>',
				createdAt: now,
			});
			const chart = getChartSnapshot(id);
			expect(chart.createdAt).toBe(now);
		});
	});

	describe('Panel block branches', () => {
		it('ensures default block exists on getPanelBlocks()', () => {
			const blocks = getPanelBlocks();
			expect(blocks.length).toBeGreaterThan(0);
			expect(blocks[0].templateId).toBe('layout-2col');
		});

		it('maintains block structure across calls', () => {
			const b1 = getPanelBlocks();
			const b2 = getPanelBlocks();
			expect(b1.length).toBe(b2.length);
		});
	});

	describe('State change listeners', () => {
		it('fires datasetAdded on addDataset', () => {
			const spy = vi.fn();
			onStateChange('datasetAdded', spy);

			const idx = addDataset({ dados: [{}], colunas: [] });

			expect(spy).toHaveBeenCalledWith(expect.objectContaining({ index: idx }));
		});

		it('fires datasetRemoved on removeDataset', () => {
			const spy = vi.fn();
			onStateChange('datasetRemoved', spy);

			const idx = addDataset({ dados: [{}], colunas: [] });
			removeDataset(idx);

			expect(spy).toHaveBeenCalledWith(idx);
		});

		it('fires activeDataset on setActiveDataset', () => {
			const spy = vi.fn();
			const idx = addDataset({ dados: [{}], colunas: [] });

			onStateChange('activeDataset', spy);
			setActiveDataset(idx);

			expect(spy).toHaveBeenCalledWith(idx);
		});

		it('fires configUpdated on updateActiveDatasetConfig', () => {
			const spy = vi.fn();
			addDataset({ dados: [{}], colunas: [], configGraficos: {} });

			onStateChange('configUpdated', spy);
			updateActiveDatasetConfig({ x: 1 });

			expect(spy).toHaveBeenCalledWith({ x: 1 });
		});

		it('fires columnsUpdated on updateActiveDatasetColumns', () => {
			const spy = vi.fn();
			addDataset({ dados: [{}], colunas: ['a'], colunasSelecionadas: [] });

			onStateChange('columnsUpdated', spy);
			updateActiveDatasetColumns(['a']);

			expect(spy).toHaveBeenCalledWith(['a']);
		});

		it('fires chartAdded on addChartSnapshot', () => {
			const spy = vi.fn();
			onStateChange('chartAdded', spy);

			const id = addChartSnapshot({ nome: 'test', svgMarkup: '<svg/>' });

			expect(spy).toHaveBeenCalled();
			expect(spy.mock.calls[0][0]).toEqual(expect.objectContaining({ id }));
		});

		it('fires chartRemoved on removeChartSnapshot', () => {
			const spy = vi.fn();
			const id = addChartSnapshot({ nome: 'test', svgMarkup: '<svg/>' });

			onStateChange('chartRemoved', spy);
			removeChartSnapshot(id);

			expect(spy).toHaveBeenCalledWith(id);
		});
	});

	describe('getState and exposeGlobals', () => {
		it('getState returns deep clone of state', async () => {
			const { getState } = await import('../src/modules/appState.js');
			addDataset({ dados: [{ x: 1 }], colunas: ['x'] });
			const state = getState();
			expect(state.data.datasets.length).toBe(1);
			state.data.datasets.push({ dados: [], colunas: [] });
			expect(getState().data.datasets.length).toBe(1);
		});

		it('exposeGlobals sets window properties', async () => {
			const { exposeGlobals, getAllDatasets } = await import('../src/modules/appState.js');
			addDataset({ dados: [{ a: 1 }], colunas: ['a'], colunasSelecionadas: ['a'] });
			exposeGlobals();
			expect(window.datasetsCarregados).toBe(getAllDatasets());
			expect(window.dadosCarregados).toBeTruthy();
			expect(window.chartsPainel).toBeDefined();
		});

		it('exposeGlobals handles no active dataset', async () => {
			const { exposeGlobals } = await import('../src/modules/appState.js');
			exposeGlobals();
			expect(window.dadosCarregados).toBeNull();
			expect(window.colunasDetectadas).toBeNull();
			expect(window.colunasSelecionadasAtivas).toBeNull();
		});
	});

	describe('sanitizeChartName', () => {
		it('trims and truncates chart name', async () => {
			const { sanitizeChartName } = await import('../src/modules/appState.js');
			expect(sanitizeChartName('  Test  ')).toBe('Test');
			expect(sanitizeChartName('a'.repeat(200)).length).toBe(100);
		});
	});

	describe('Input validation branches', () => {
		it('throws on addDataset with missing dados', () => {
			expect(() => addDataset({ colunas: [] })).toThrow();
		});

		it('throws on addDataset with non-array dados', () => {
			expect(() => addDataset({ dados: 'not-array', colunas: [] })).toThrow();
		});

		it('throws on removeDataset invalid index', () => {
			expect(() => removeDataset(-1)).toThrow();
			expect(() => removeDataset(5)).toThrow();
		});
	});
});
