import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce } from '../../src/utils/debounce.js';

describe('debounce', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('delays invocation until wait elapses', () => {
		const fn = vi.fn();
		const d = debounce(fn, 100);

		d('a');
		expect(fn).not.toHaveBeenCalled();

		vi.advanceTimersByTime(99);
		expect(fn).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(fn).toHaveBeenCalledTimes(1);
		expect(fn).toHaveBeenCalledWith('a');
	});

	it('coalesces bursts into a single trailing call with the latest args', () => {
		const fn = vi.fn();
		const d = debounce(fn, 100);

		d(1);
		vi.advanceTimersByTime(50);
		d(2);
		vi.advanceTimersByTime(50);
		d(3);
		vi.advanceTimersByTime(100);

		expect(fn).toHaveBeenCalledTimes(1);
		expect(fn).toHaveBeenCalledWith(3);
	});

	it('cancel() drops the pending invocation', () => {
		const fn = vi.fn();
		const d = debounce(fn, 100);

		d('a');
		d.cancel();
		vi.advanceTimersByTime(500);

		expect(fn).not.toHaveBeenCalled();
	});

	it('flush() invokes immediately with the latest args', () => {
		const fn = vi.fn();
		const d = debounce(fn, 100);

		d('a');
		d('b');
		d.flush();

		expect(fn).toHaveBeenCalledTimes(1);
		expect(fn).toHaveBeenCalledWith('b');
	});

	it('flush() is a no-op when nothing is pending', () => {
		const fn = vi.fn();
		const d = debounce(fn, 100);

		d.flush();
		expect(fn).not.toHaveBeenCalled();
	});

	it('flush() does not also fire the timer afterwards', () => {
		const fn = vi.fn();
		const d = debounce(fn, 100);

		d('a');
		d.flush();
		vi.advanceTimersByTime(500);

		expect(fn).toHaveBeenCalledTimes(1);
	});
});
