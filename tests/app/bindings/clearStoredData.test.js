// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
import {
	__resetProjectOperationLockForTesting,
	acquireProjectOperation,
	getRunningProjectOperation,
} from '../../../src/app/bindings/projectOperationLock.js';

describe('clearStoredProjectData', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		__resetProjectOperationLockForTesting();
		mocks.openConfirmDialog.mockResolvedValue(true);
		mocks.clearPersistedState.mockResolvedValue({ ok: true });
	});

	afterEach(() => {
		__resetProjectOperationLockForTesting();
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

	it('wipes inside the suspension window, so no save can land after the deletion', async () => {
		const order = [];
		const withSavesSuspended = vi.fn(async operation => {
			order.push('suspended');
			try {
				return await operation();
			} finally {
				order.push('resumed');
			}
		});
		mocks.clearPersistedState.mockImplementation(async () => {
			order.push('cleared');
			return { ok: true };
		});

		await expect(clearStoredProjectData({ withSavesSuspended })).resolves.toEqual({ ok: true });
		expect(order).toEqual(['suspended', 'cleared', 'resumed']);
	});

	it('works without a suspension dependency', async () => {
		await expect(clearStoredProjectData({})).resolves.toEqual({ ok: true });
		expect(mocks.clearPersistedState).toHaveBeenCalledTimes(1);
	});

	it('reports a blocked deletion distinctly, since the user can act on it', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		mocks.clearPersistedState.mockResolvedValue({ ok: false, reason: 'blocked' });

		await expect(clearStoredProjectData()).resolves.toEqual({ ok: false, reason: 'blocked' });
	});

	it('reports a failed deletion that the service resolved rather than threw', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		mocks.clearPersistedState.mockResolvedValue({ ok: false, reason: 'error' });

		await expect(clearStoredProjectData()).resolves.toEqual({ ok: false, reason: 'error' });
	});

	it('reports an unexpected rejection instead of throwing', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		mocks.clearPersistedState.mockRejectedValue(new Error('backend gone'));

		await expect(clearStoredProjectData()).resolves.toEqual({ ok: false, reason: 'error' });
	});

	it('refuses to start while another project operation holds the lock', async () => {
		const release = acquireProjectOperation('import');

		await expect(clearStoredProjectData()).resolves.toEqual({ ok: false, busy: true });
		// Not even the confirmation is shown: a prompt the app cannot honour is
		// worse than an explanation.
		expect(mocks.openConfirmDialog).not.toHaveBeenCalled();
		expect(mocks.clearPersistedState).not.toHaveBeenCalled();

		release();
		await expect(clearStoredProjectData()).resolves.toEqual({ ok: true });
	});

	it('holds the lock across the confirmation and releases it on every path', async () => {
		let answer;
		mocks.openConfirmDialog.mockImplementation(() => new Promise(resolve => { answer = resolve; }));

		const done = clearStoredProjectData();
		await Promise.resolve();
		expect(getRunningProjectOperation()).toBe('clear');

		answer(false);
		await expect(done).resolves.toEqual({ ok: true, cancelled: true });
		expect(getRunningProjectOperation()).toBeNull();
	});

	it('releases the lock after a rejected wipe', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		mocks.clearPersistedState.mockRejectedValue(new Error('backend gone'));

		await clearStoredProjectData();

		expect(getRunningProjectOperation()).toBeNull();
	});
});
