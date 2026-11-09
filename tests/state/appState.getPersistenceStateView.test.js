// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import {
	addChartSnapshot,
	addDataset,
	applyStateSnapshot,
	getAllDatasets,
	getPanelCharts,
	getPersistenceStateView,
	removeDataset,
	setActiveChartType,
	setActiveDatasetColumnSelection,
	updateActiveDatasetConfig,
} from '../../src/state/appState.js';

function resetAppStateForTest() {
	applyStateSnapshot({
		data: { datasets: [], activeIndex: -1 },
		panel: { charts: [], slots: {}, layout: 'template-2col', blocks: [], nextBlockId: 1, nextChartId: 0 },
		ui: { sidebarMode: 'data', previewRows: 10 },
	});
}

function makeDataset(id, rows) {
	return {
		id,
		name: `${id}.csv`,
		sizeLabel: '1 KB',
		rows,
		columns: [{ name: 'x', type: 'number' }],
		selectedColumns: ['x'],
		chartConfig: {},
	};
}

describe('getPersistenceStateView', () => {
	beforeEach(() => {
		resetAppStateForTest();
	});

	it('returns the persistence-shaped envelope', () => {
		const stateView = getPersistenceStateView();
		expect(Object.keys(stateView).sort()).toEqual(['data', 'panel', 'ui']);
		expect(Object.keys(stateView.data).sort()).toEqual(['activeIndex', 'datasets']);
		expect(stateView.ui).toEqual({ sidebarMode: 'data', previewRows: 10 });
	});

	it('returns LIVE references, not a clone', () => {
		const stateView = getPersistenceStateView();
		// Same array identity as the live getter.
		expect(stateView.data.datasets).toBe(getAllDatasets());
		expect(stateView.panel.charts).toBe(getPanelCharts());

		// A later mutation through the facade is visible in the already-taken
		// view, proving it is not a frozen deep clone.
		addDataset(makeDataset('d1', [{ x: 1 }]));
		expect(stateView.data.datasets).toHaveLength(1);
	});
});

describe('payload immutability invariant (persistence dedup dependency)', () => {
	beforeEach(() => {
		resetAppStateForTest();
	});

	it('keeps a dataset rows reference stable across metadata-only edits', () => {
		const rows = [{ x: 1 }, { x: 2 }];
		addDataset(makeDataset('d1', rows));

		const before = getPersistenceStateView().data.datasets[0].rows;

		// Pure metadata edits: chart config + selected columns.
		updateActiveDatasetConfig({ activeTab: 'viz' });
		setActiveDatasetColumnSelection(['x']);
		setActiveChartType('bar');

		const after = getPersistenceStateView().data.datasets[0].rows;
		expect(after).toBe(before);   // same array reference, dedup stays valid
	});

	it('keeps a chart dataSnapshot / columnsSnapshot reference stable across metadata edits', () => {
		addDataset(makeDataset('d1', [{ x: 1 }]));
		const dataSnapshot = [{ x: 1 }];
		const columnsSnapshot = [{ name: 'x', type: 'number' }];
		addChartSnapshot({ name: 'C', type: 'bar', config: {}, dataSnapshot, columnsSnapshot });

		const beforeData = getPersistenceStateView().panel.charts[0].dataSnapshot;
		const beforeCols = getPersistenceStateView().panel.charts[0].columnsSnapshot;

		updateActiveDatasetConfig({ activeTab: 'viz' });
		setActiveChartType('scatter');

		const afterData = getPersistenceStateView().panel.charts[0].dataSnapshot;
		const afterCols = getPersistenceStateView().panel.charts[0].columnsSnapshot;
		expect(afterData).toBe(beforeData);
		expect(afterCols).toBe(beforeCols);
	});

	it('replaces the rows reference only on remove + add (a future in-place editor would trip dedup)', () => {
		addDataset(makeDataset('d1', [{ x: 1 }]));
		const before = getPersistenceStateView().data.datasets[0].rows;

		removeDataset(0);
		addDataset(makeDataset('d2', [{ x: 9 }]));

		const after = getPersistenceStateView().data.datasets[0].rows;
		expect(after).not.toBe(before);   // new id, new array → re-sent, as intended
	});
});
