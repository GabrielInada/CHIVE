// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	calculateStatistics: vi.fn(),
	calculateCategoricalStatistics: vi.fn(),
	getActiveDataset: vi.fn(),
	t: vi.fn((key, ...args) => (args.length ? `${key}:${args.join(',')}` : key)),
	getLocale: vi.fn(() => 'en-US'),
}));

vi.mock('../../../../src/domain/datasets/statistics.js', () => ({
	calculateStatistics: mocks.calculateStatistics,
	calculateCategoricalStatistics: mocks.calculateCategoricalStatistics,
}));

vi.mock('../../../../src/state/appState.js', () => ({
	getActiveDataset: mocks.getActiveDataset,
}));

vi.mock('../../../../src/services/i18nService.js', () => ({
	t: mocks.t,
	getLocale: mocks.getLocale,
}));

import { renderCategoricalStats, renderStats } from '../../../../src/features/datasetWorkspace/views/statsView.js';
import { STATS_NUMERIC_VERSION } from '../../../../src/config/statistics.js';

const rows = [
	{ region: 'North', value: 10 },
	{ region: 'South', value: 20 },
];

const visibleColumns = [
	{ name: 'region', type: 'text' },
	{ name: 'value', type: 'number' },
];

function setupDom() {
	document.body.innerHTML = `
		<section id="card-stats">
			<span id="badge-num-columns"></span>
			<div id="container-stats"></div>
		</section>
		<section id="card-cat-stats">
			<span id="badge-cat-columns"></span>
			<div id="container-cat-stats"></div>
		</section>
	`;
}

describe('statsView', () => {
	beforeEach(() => {
		setupDom();
		vi.clearAllMocks();
		mocks.getActiveDataset.mockReturnValue(null);
		mocks.calculateStatistics.mockReturnValue([]);
		mocks.calculateCategoricalStatistics.mockReturnValue([]);
	});

	it('renders precomputed numeric stats for visible numeric columns only', () => {
		mocks.getActiveDataset.mockReturnValue({
			rows,
			precomputedStats: {
				numericVersion: STATS_NUMERIC_VERSION,
				numeric: [
					{ name: 'value', n: 2, min: 10, max: 20, mean: 15, median: 15 },
					{ name: 'hidden', n: 2, min: 1, max: 2, mean: 1.5, median: 1.5 },
				],
			},
		});

		renderStats(rows, visibleColumns);

		expect(mocks.calculateStatistics).not.toHaveBeenCalled();
		expect(document.getElementById('card-stats').hidden).toBe(false);
		expect(document.getElementById('badge-num-columns').textContent).toBe('chive-stats-badge:1');
		expect(document.querySelectorAll('#container-stats .stat-col').length).toBe(1);
		expect(document.querySelector('.stat-col-name').textContent).toBe('value');
		expect(document.getElementById('container-stats').textContent).toContain('chive-stat-mean');
	});

	it('falls back to live numeric calculation and hides the card when no stats exist', () => {
		mocks.calculateStatistics.mockReturnValueOnce([
			{ name: 'value', n: 2, min: 10, max: 20, mean: 15, median: 15 },
		]);

		renderStats(rows, visibleColumns);
		expect(mocks.calculateStatistics).toHaveBeenCalledWith(rows, visibleColumns);
		expect(document.querySelectorAll('#container-stats .stat-col').length).toBe(1);

		mocks.calculateStatistics.mockReturnValueOnce([]);
		renderStats(rows, visibleColumns);
		expect(document.getElementById('card-stats').hidden).toBe(true);
		expect(document.getElementById('container-stats').children.length).toBe(0);
	});

	// The recompute cache is keyed by rows identity and lives for the module's
	// lifetime, so each of these builds its own array rather than sharing the
	// module-level `rows` fixture.
	it.each([
		['a stale version', 0],
		['no version at all', undefined],
	])('recomputes numeric stats live when the cache carries %s', (_label, numericVersion) => {
		const ownRows = rows.map(row => ({ ...row }));
		const staleStats = [{ name: 'value', n: 2, min: '', max: 20, mean: 10, median: 10 }];
		mocks.getActiveDataset.mockReturnValue({
			rows: ownRows,
			columns: visibleColumns,
			precomputedStats: { numericVersion, numeric: staleStats },
		});
		mocks.calculateStatistics.mockReturnValue([
			{ name: 'value', n: 2, min: 10, max: 20, mean: 15, median: 15 },
		]);

		renderStats(ownRows, visibleColumns);

		expect(mocks.calculateStatistics).toHaveBeenCalledWith(ownRows, visibleColumns);
		expect(document.querySelectorAll('#container-stats .stat-col').length).toBe(1);
	});

	it('scans the rows once when the same recomputed dataset is re-rendered', () => {
		const ownRows = rows.map(row => ({ ...row }));
		mocks.getActiveDataset.mockReturnValue({
			rows: ownRows,
			columns: visibleColumns,
			precomputedStats: { numeric: [], categorical: [] },
		});
		mocks.calculateStatistics.mockReturnValue([
			{ name: 'value', n: 2, min: 10, max: 20, mean: 15, median: 15 },
		]);

		renderStats(ownRows, visibleColumns);
		renderStats(ownRows, visibleColumns);
		renderStats(ownRows, visibleColumns);

		expect(mocks.calculateStatistics).toHaveBeenCalledTimes(1);
		expect(document.querySelectorAll('#container-stats .stat-col').length).toBe(1);
	});

	it('renders categorical stats including empty-column placeholders', () => {
		mocks.getActiveDataset.mockReturnValue({
			rows,
			precomputedStats: {
				categorical: [
					{
						name: 'region',
						n: 2,
						missing: 0,
						missingPct: 0,
						unique: 2,
						uniquenessRate: 1,
						mode: 'A very long region name',
						modeCount: 1,
						modePct: 0.5,
						top5Pct: 1,
					},
					{
						name: 'emptyText',
						empty: true,
						missing: 2,
						missingPct: 1,
					},
				],
			},
		});

		renderCategoricalStats(rows, [
			{ name: 'region', type: 'text' },
			{ name: 'emptyText', type: 'text' },
			{ name: 'value', type: 'number' },
		]);

		expect(mocks.calculateCategoricalStatistics).not.toHaveBeenCalled();
		expect(document.getElementById('card-cat-stats').hidden).toBe(false);
		expect(document.getElementById('badge-cat-columns').textContent).toBe('chive-cat-stats-badge:2');
		expect(document.querySelectorAll('#container-cat-stats .stat-col').length).toBe(2);
		expect(document.querySelector('[title="A very long region name"]')).not.toBeNull();
		expect(document.getElementById('container-cat-stats').textContent).toContain('chive-cat-stat-empty');
	});

	it('falls back to live categorical calculation and tolerates missing optional DOM nodes', () => {
		mocks.calculateCategoricalStatistics.mockReturnValueOnce([
			{
				name: 'region',
				n: 2,
				missing: 0,
				missingPct: 0,
				unique: 2,
				uniquenessRate: 1,
				mode: 'North',
				modeCount: 1,
				modePct: 0.5,
				top5Pct: 1,
			},
		]);

		renderCategoricalStats(rows, visibleColumns);
		expect(mocks.calculateCategoricalStatistics).toHaveBeenCalledWith(rows, visibleColumns);
		expect(document.querySelectorAll('#container-cat-stats .stat-col').length).toBe(1);

		document.body.innerHTML = '';
		expect(() => renderCategoricalStats(rows, visibleColumns)).not.toThrow();
	});

	it('hides categorical card when stats are empty even if the container is absent', () => {
		document.body.innerHTML = '<section id="card-cat-stats"></section>';
		mocks.calculateCategoricalStatistics.mockReturnValueOnce([]);

		expect(() => renderCategoricalStats(rows, visibleColumns)).not.toThrow();
		expect(document.getElementById('card-cat-stats').hidden).toBe(true);
	});
});
