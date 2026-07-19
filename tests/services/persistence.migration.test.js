// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	clearPersistedState,
	configurePersistenceBackend,
	hydrateState,
	persistState,
} from '../../src/services/persistence.js';
import {
	goodRecord,
	makeBackend,
	makeSnapshot,
	writeLegacyState,
} from './persistence.testSupport.js';

describe('persistence', () => {
	beforeEach(async () => {
		configurePersistenceBackend(makeBackend());
		await clearPersistedState();
		localStorage.clear();
	});

	afterEach(async () => {
		await clearPersistedState();
		localStorage.clear();
		configurePersistenceBackend(null);
	});

	it('imports the legacy raw IndexedDB stores once when no SQLite blob exists', async () => {
		await writeLegacyState({
			datasets: [goodRecord('legacy')],
			panelRecord: {
				activeDatasetId: 'legacy',
				charts: [],
				slots: {},
				layout: 'template-2col',
				blocks: [],
				nextBlockId: 1,
				nextChartId: 0,
			},
		});
		const replaceAllState = vi.fn();

		await hydrateState({ replaceAllState });

		expect(replaceAllState).toHaveBeenCalledTimes(1);
		expect(replaceAllState.mock.calls[0][0].data.datasets[0].id).toBe('legacy');
		expect(localStorage.getItem('chive.migrated')).toBe('1');

		const secondReplace = vi.fn();
		await hydrateState({ replaceAllState: secondReplace });
		expect(secondReplace).toHaveBeenCalledTimes(1);
		expect(secondReplace.mock.calls[0][0].data.datasets[0].id).toBe('legacy');
	});

	it('clearPersistedState removes project/UI state, sets the legacy tombstone, and keeps browser preferences', async () => {
		localStorage.setItem('chive.ui', JSON.stringify({ sidebarMode: 'panel', previewRows: 20 }));
		localStorage.setItem('chive-locale', 'en');
		localStorage.setItem('chive.settings', JSON.stringify({ tinColorRendering: 'full-ramp' }));
		await persistState(makeSnapshot());

		await clearPersistedState();

		expect(localStorage.getItem('chive.ui')).toBeNull();
		expect(localStorage.getItem('chive-locale')).toBe('en');
		expect(JSON.parse(localStorage.getItem('chive.settings'))).toEqual({ tinColorRendering: 'full-ramp' });
		expect(localStorage.getItem('chive.migrated')).toBe('1');
		const replaceAllState = vi.fn();
		await hydrateState({ replaceAllState });
		expect(replaceAllState).not.toHaveBeenCalled();
	});
});
