import { describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getState: vi.fn(),
}));

vi.mock('../../../src/modules/state/appState.js', () => ({
	getState: mocks.getState,
}));

import { getStateSummary } from '../../../src/modules/state/stateDebug.js';

describe('stateDebug getStateSummary', () => {
	it('returns counts/indices/layout/mode without dataset names', () => {
		mocks.getState.mockReturnValue({
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
});
