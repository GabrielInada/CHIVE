// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	clearPersistedState: vi.fn(),
	openConfirmDialog: vi.fn(),
	replaceAllState: vi.fn(),
	t: vi.fn(key => `tr:${key}`),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
}));

vi.mock('../../../src/services/persistence.js', () => ({
	clearPersistedState: mocks.clearPersistedState,
}));

vi.mock('../../../src/ui/confirmDialog.js', () => ({
	openConfirmDialog: mocks.openConfirmDialog,
}));

vi.mock('../../../src/state/appState.js', () => ({
	replaceAllState: mocks.replaceAllState,
}));

import { clearStoredProjectData } from '../../../src/app/bindings/clearStoredData.js';

describe('clearStoredProjectData', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.openConfirmDialog.mockResolvedValue(true);
		mocks.clearPersistedState.mockResolvedValue(undefined);
	});

	it('asks for confirmation with localized destructive copy', async () => {
		await clearStoredProjectData();

		expect(mocks.openConfirmDialog).toHaveBeenCalledWith({
			title: 'tr:chive-settings-data-clear-confirm-title',
			message: 'tr:chive-settings-data-clear-confirm',
			confirmLabel: 'tr:chive-confirm-continue',
			cancelLabel: 'tr:chive-confirm-cancel',
		});
	});

	it('touches neither state nor storage when the confirmation is declined', async () => {
		mocks.openConfirmDialog.mockResolvedValue(false);

		await expect(clearStoredProjectData()).resolves.toEqual({ ok: true, cancelled: true });
		expect(mocks.replaceAllState).not.toHaveBeenCalled();
		expect(mocks.clearPersistedState).not.toHaveBeenCalled();
	});

	it('resets state to an empty project before wiping storage', async () => {
		await expect(clearStoredProjectData()).resolves.toEqual({ ok: true });

		expect(mocks.replaceAllState).toHaveBeenCalledWith({
			data: { datasets: [], activeIndex: -1 },
			panel: {},
		});
		expect(mocks.replaceAllState.mock.invocationCallOrder[0])
			.toBeLessThan(mocks.clearPersistedState.mock.invocationCallOrder[0]);
		expect(mocks.clearPersistedState).toHaveBeenCalledTimes(1);
	});

	it('settles a pending save before wiping, so an in-flight write cannot restore the data', async () => {
		const order = [];
		let releaseSave;
		const flushPendingSave = vi.fn(() => new Promise(resolve => {
			releaseSave = () => {
				order.push('save-settled');
				resolve();
			};
		}));
		mocks.clearPersistedState.mockImplementation(async () => {
			order.push('cleared');
		});

		const done = clearStoredProjectData({ flushPendingSave });
		await Promise.resolve();
		await Promise.resolve();

		expect(flushPendingSave).toHaveBeenCalledTimes(1);
		expect(mocks.clearPersistedState).not.toHaveBeenCalled();

		releaseSave();
		await expect(done).resolves.toEqual({ ok: true });
		expect(order).toEqual(['save-settled', 'cleared']);
	});

	it('works without a flush dependency', async () => {
		await expect(clearStoredProjectData({})).resolves.toEqual({ ok: true });
		expect(mocks.clearPersistedState).toHaveBeenCalledTimes(1);
	});

	it('reports a failed wipe instead of throwing', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		mocks.clearPersistedState.mockRejectedValue(new Error('backend gone'));

		await expect(clearStoredProjectData()).resolves.toEqual({ ok: false });
	});

	it('still wipes when the flush fails, since a failed save must not block a requested wipe', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const flushPendingSave = vi.fn().mockRejectedValue(new Error('save exploded'));

		await expect(clearStoredProjectData({ flushPendingSave })).resolves.toEqual({ ok: true });
		expect(mocks.clearPersistedState).toHaveBeenCalledTimes(1);
	});
});
