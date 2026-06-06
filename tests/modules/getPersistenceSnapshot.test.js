// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import {
	addChartSnapshot,
	addDataset,
	getAllDatasets,
	getPanelCharts,
	getPersistenceSnapshot,
	removeDataset,
	replaceAllState,
	setActiveChartType,
	updateActiveDatasetColumns,
	updateActiveDatasetConfig,
} from '../../src/modules/state/appState.js';

function resetAppStateForTest() {
	replaceAllState({
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

describe('getPersistenceSnapshot', () => {
	beforeEach(() => {
		resetAppStateForTest();
	});

	it('returns the persistence-shaped envelope', () => {
		const snapshot = getPersistenceSnapshot();
		expect(Object.keys(snapshot).sort()).toEqual(['data', 'panel', 'ui']);
		expect(Object.keys(snapshot.data).sort()).toEqual(['activeIndex', 'datasets']);
		expect(snapshot.ui).toEqual({ sidebarMode: 'data', previewRows: 10 });
	});

	it('returns LIVE references, not a clone', () => {
		const snapshot = getPersistenceSnapshot();
		// Same array identity as the live getter.
		expect(snapshot.data.datasets).toBe(getAllDatasets());
		expect(snapshot.panel.charts).toBe(getPanelCharts());

		// A later mutation through the facade is visible in the already-taken
		// snapshot, proving it is not a frozen deep clone.
		addDataset(makeDataset('d1', [{ x: 1 }]));
		expect(snapshot.data.datasets).toHaveLength(1);
	});
});

describe('payload immutability invariant (Stage 2 dedup dependency)', () => {
	beforeEach(() => {
		resetAppStateForTest();
	});

	it('keeps a dataset rows reference stable across metadata-only edits', () => {
		const rows = [{ x: 1 }, { x: 2 }];
		addDataset(makeDataset('d1', rows));

		const before = getPersistenceSnapshot().data.datasets[0].rows;

		// Pure metadata edits: chart config + selected columns.
		updateActiveDatasetConfig({ activeTab: 'viz' });
		updateActiveDatasetColumns(['x']);
		setActiveChartType('bar');

		const after = getPersistenceSnapshot().data.datasets[0].rows;
		expect(after).toBe(before);   // same array reference, dedup stays valid
	});

	it('keeps a chart dataSnapshot / columnsSnapshot reference stable across metadata edits', () => {
		addDataset(makeDataset('d1', [{ x: 1 }]));
		const dataSnapshot = [{ x: 1 }];
		const columnsSnapshot = [{ name: 'x', type: 'number' }];
		addChartSnapshot({ name: 'C', type: 'bar', config: {}, dataSnapshot, columnsSnapshot });

		const beforeData = getPersistenceSnapshot().panel.charts[0].dataSnapshot;
		const beforeCols = getPersistenceSnapshot().panel.charts[0].columnsSnapshot;

		updateActiveDatasetConfig({ activeTab: 'viz' });
		setActiveChartType('scatter');

		const afterData = getPersistenceSnapshot().panel.charts[0].dataSnapshot;
		const afterCols = getPersistenceSnapshot().panel.charts[0].columnsSnapshot;
		expect(afterData).toBe(beforeData);
		expect(afterCols).toBe(beforeCols);
	});

	it('replaces the rows reference only on remove + add (a future in-place editor would trip dedup)', () => {
		addDataset(makeDataset('d1', [{ x: 1 }]));
		const before = getPersistenceSnapshot().data.datasets[0].rows;

		removeDataset(0);
		addDataset(makeDataset('d2', [{ x: 9 }]));

		const after = getPersistenceSnapshot().data.datasets[0].rows;
		expect(after).not.toBe(before);   // new id, new array → re-sent, as intended
	});
});
