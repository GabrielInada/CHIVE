import { describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getPersistenceStateView: vi.fn(),
}));

vi.mock('../../src/state/appState.js', () => ({
	getPersistenceStateView: mocks.getPersistenceStateView,
}));

import { getStateSummary } from '../../src/state/stateDebug.js';

describe('stateDebug getStateSummary', () => {
	it('returns counts/indices/layout/mode without dataset names', () => {
		mocks.getPersistenceStateView.mockReturnValue({
			data: { datasets: [{ name: 'secret.csv' }, { name: 'b' }], activeIndex: 1 },
			panel: { charts: [{}, {}, {}], layout: 'grid-2' },
			ui: { sidebarMode: 'panel' },
		});

		const summary = getStateSummary();

		expect(summary).toEqual({
			datasetsCount: 2,
			activeDatasetIndex: 1,
			panelChartsCount: 3,
			panelLayout: 'grid-2',
			sidebarMode: 'panel',
		});
		// The summary must not echo uploaded dataset names.
		expect(JSON.stringify(summary)).not.toContain('secret.csv');
	});

	it('never traverses datasets or chart payloads to read metadata', () => {
		const inaccessible = new Proxy({}, {
			get() { throw new Error('Payload traversal is forbidden'); },
		});
		mocks.getPersistenceStateView.mockReturnValue({
			data: { datasets: [inaccessible], activeIndex: 0 },
			panel: { charts: [inaccessible], layout: 'template-2col' },
			ui: { sidebarMode: 'data' },
		});

		expect(getStateSummary()).toMatchObject({ datasetsCount: 1, panelChartsCount: 1 });
	});
});
