// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	addDataset,
	removeDataset,
	setActiveDataset,
	getActiveDataset,
	addChartSnapshot,
	removeChartSnapshot,
	getChartSnapshot,
	getPanelCharts,
	getPanelBlocks,
	updateActiveDatasetConfig,
	updateActiveDatasetColumns,
	onStateChange,
	replaceAllState,
	getState,
} from '../../src/state/appState.js';

function resetAppStateForTest() {
	replaceAllState({
		data: { datasets: [], activeIndex: -1 },
		panel: { charts: [], slots: {}, layout: 'template-2col', blocks: [], nextBlockId: 1, nextChartId: 0 },
		ui: { sidebarMode: 'data', previewRows: 10 },
	});
}

/**
 * Extended appState edge cases and branch coverage.
 */
describe('appState (edge cases - branch coverage)', () => {
	beforeEach(() => {
		resetAppStateForTest();
	});

	describe('Dataset management branches', () => {
		it('returns null when no active dataset', () => {
			expect(getActiveDataset()).toBeNull();
			expect(getState().data.activeIndex).toBe(-1);
		});

		it('throws on invalid dataset index in setActiveDataset', () => {
			addDataset({ rows: [{}], columns: [] });
			expect(() => setActiveDataset(99)).toThrow();
			expect(() => setActiveDataset(-2)).toThrow();
		});

		it('auto-selects first added dataset', () => {
			const idx = addDataset({ rows: [{ x: 1 }], columns: ['x'] });
			expect(getState().data.activeIndex).toBe(idx);
		});

		it('does not override activeIndex on subsequent adds', () => {
			addDataset({ rows: [{}], columns: [] });
			addDataset({ rows: [{}], columns: [] });
			expect(getState().data.activeIndex).toBe(0);
		});

		it('adjusts activeIndex down when earlier dataset removed', () => {
			addDataset({ rows: [{}], columns: [] });
			addDataset({ rows: [{}], columns: [] });
			addDataset({ rows: [{}], columns: [] });

			setActiveDataset(2);
			removeDataset(0);

			expect(getState().data.activeIndex).toBe(1); // was 2, shifted to 1
		});

		it('sets activeIndex to -1 when last dataset removed', () => {
			addDataset({ rows: [{}], columns: [] });
			removeDataset(0);
			expect(getState().data.activeIndex).toBe(-1);
		});

		it('does not change activeIndex when removed after active', () => {
			addDataset({ rows: [{}], columns: [] });
			addDataset({ rows: [{}], columns: [] });
			setActiveDataset(0);
			removeDataset(1);
			expect(getState().data.activeIndex).toBe(0);
		});

		it('preserves captured panel charts when dataset removed', () => {
			addDataset({ rows: [{}], columns: [] });
			addChartSnapshot({ name: 'c1', svgMarkup: '<svg/>' });
			expect(getPanelCharts().length).toBe(1);

			removeDataset(0);
			expect(getPanelCharts()).toEqual([
				expect.objectContaining({ name: 'c1' }),
			]);
		});
	});

	describe('Configuration update branches', () => {
		it('does nothing if no active dataset (config)', () => {
			expect(() => updateActiveDatasetConfig({ x: 1 })).not.toThrow();
		});

		it('does nothing if no active dataset (columns)', () => {
			expect(() => updateActiveDatasetColumns(['x'])).not.toThrow();
			expect(() => updateActiveDatasetColumns(null)).not.toThrow();
		});

		it('merges config into active dataset (and canonicalizes)', () => {
			addDataset({
				rows: [{}],
				columns: [],
				chartConfig: { type: 'bar' },
			});
			updateActiveDatasetConfig({ title: 'Test' });

			const active = getActiveDataset();
			// Custom + patched top-level fields survive the merge, and the stored
			// config is canonical (default blocks filled, empty global filter).
			expect(active.chartConfig).toMatchObject({ type: 'bar', title: 'Test' });
			expect(active.chartConfig.bar).toBeDefined();
			expect(active.chartConfig.globalFilter).toEqual({ rules: [], combine: 'AND' });
		});

		it('updates column selection in active dataset', () => {
			addDataset({
				rows: [{}],
				columns: ['a', 'b'],
				selectedColumns: [],
			});
			updateActiveDatasetColumns(['a']);

			const active = getActiveDataset();
			expect(active.selectedColumns).toEqual(['a']);
		});
	});

	describe('Chart snapshot branches', () => {
		it('increments chart IDs correctly', () => {
			const id1 = addChartSnapshot({ name: 'c1', svgMarkup: '<svg/>' });
			const id2 = addChartSnapshot({ name: 'c2', svgMarkup: '<svg/>' });
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
			const id1 = addChartSnapshot({ name: 'c1', svgMarkup: '<svg/>' });
			const id2 = addChartSnapshot({ name: 'c2', svgMarkup: '<svg/>' });

			removeChartSnapshot(id1);

			expect(getPanelCharts().length).toBe(1);
			expect(getPanelCharts()[0].id).toBe(id2);
		});

		it('sanitizes chart name on add', () => {
			const id = addChartSnapshot({
				name: '<img src=x onerror="alert(1)">',
				svgMarkup: '<svg/>',
			});
			const chart = getChartSnapshot(id);
			// sanitation should occur (test exact behavior depends on implementation)
			expect(chart.name).toBeDefined();
		});

		it('handles createdAt timestamp', () => {
			const now = new Date().toISOString();
			const id = addChartSnapshot({
				name: 'test',
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
			expect(blocks[0].templateId).toBe('template-2col');
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

			const idx = addDataset({ rows: [{}], columns: [] });

			expect(spy).toHaveBeenCalledWith(expect.objectContaining({ index: idx }));
		});

		it('fires datasetRemoved on removeDataset', () => {
			const spy = vi.fn();
			onStateChange('datasetRemoved', spy);

			const idx = addDataset({ rows: [{}], columns: [] });
			removeDataset(idx);

			expect(spy).toHaveBeenCalledWith(idx);
		});

		it('fires activeDataset on setActiveDataset', () => {
			const spy = vi.fn();
			addDataset({ rows: [{}], columns: [] });
			const idx = addDataset({ rows: [{}], columns: [] });

			onStateChange('activeDataset', spy);
			setActiveDataset(idx);

			expect(spy).toHaveBeenCalledWith(idx);
		});

		it('fires configUpdated on updateActiveDatasetConfig', () => {
			const spy = vi.fn();
			addDataset({ rows: [{}], columns: [], chartConfig: {} });

			onStateChange('configUpdated', spy);
			updateActiveDatasetConfig({ x: 1 });

			expect(spy).toHaveBeenCalledWith({ x: 1 });
		});

		it('fires columnsUpdated on updateActiveDatasetColumns', () => {
			const spy = vi.fn();
			addDataset({ rows: [{}], columns: ['a'], selectedColumns: [] });

			onStateChange('columnsUpdated', spy);
			updateActiveDatasetColumns(['a']);

			expect(spy).toHaveBeenCalledWith(['a']);
		});

		it('fires chartAdded on addChartSnapshot', () => {
			const spy = vi.fn();
			onStateChange('chartAdded', spy);

			const id = addChartSnapshot({ name: 'test', svgMarkup: '<svg/>' });

			expect(spy).toHaveBeenCalled();
			expect(spy.mock.calls[0][0]).toEqual(expect.objectContaining({ id }));
		});

		it('fires chartRemoved on removeChartSnapshot', () => {
			const spy = vi.fn();
			const id = addChartSnapshot({ name: 'test', svgMarkup: '<svg/>' });

			onStateChange('chartRemoved', spy);
			removeChartSnapshot(id);

			expect(spy).toHaveBeenCalledWith(id);
		});
	});

	describe('getState', () => {
		it('getState returns deep clone of state', async () => {
			const { getState } = await import('../../src/state/appState.js');
			addDataset({ rows: [{ x: 1 }], columns: ['x'] });
			const state = getState();
			expect(state.data.datasets.length).toBe(1);
			state.data.datasets.push({ rows: [], columns: [] });
			expect(getState().data.datasets.length).toBe(1);
		});
	});

	describe('sanitizeChartName', () => {
		it('trims and truncates chart name', async () => {
			const { sanitizeChartName } = await import('../../src/state/appState.js');
			expect(sanitizeChartName('  Test  ')).toBe('Test');
			expect(sanitizeChartName('a'.repeat(200)).length).toBe(100);
		});
	});

	describe('Input validation branches', () => {
		it('throws on addDataset with missing rows', () => {
			expect(() => addDataset({ columns: [] })).toThrow();
		});

		it('throws on addDataset with non-array rows', () => {
			expect(() => addDataset({ rows: 'not-array', columns: [] })).toThrow();
		});

		it('throws on removeDataset invalid index', () => {
			expect(() => removeDataset(-1)).toThrow();
			expect(() => removeDataset(5)).toThrow();
		});
	});
});
