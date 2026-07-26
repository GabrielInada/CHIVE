import { afterEach, describe, expect, it } from 'vitest';

import {
	__resetProjectOperationLockForTesting,
	acquireProjectOperation,
	getRunningProjectOperation,
} from '../../../src/app/bindings/projectOperationLock.js';

describe('projectOperationLock', () => {
	afterEach(() => {
		__resetProjectOperationLockForTesting();
	});

	it('grants the lock to one operation at a time', () => {
		const release = acquireProjectOperation('import');

		expect(typeof release).toBe('function');
		expect(getRunningProjectOperation()).toBe('import');
		expect(acquireProjectOperation('clear')).toBeNull();

		release();
		expect(getRunningProjectOperation()).toBeNull();
		expect(acquireProjectOperation('clear')).not.toBeNull();
	});

	it('ignores a repeated release so it cannot hand the lock away twice', () => {
		const release = acquireProjectOperation('export');
		release();

		const second = acquireProjectOperation('clear');
		expect(second).not.toBeNull();

		// The stale release must not free the lock the new holder owns.
		release();
		expect(getRunningProjectOperation()).toBe('clear');
	});
});
