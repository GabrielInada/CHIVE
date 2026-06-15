import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { throttle } from '../../src/utils/throttle.js';

describe('throttle', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('invokes immediately on the leading edge', () => {
		const fn = vi.fn();
		const th = throttle(fn, 100);

		th('a');
		expect(fn).toHaveBeenCalledTimes(1);
		expect(fn).toHaveBeenCalledWith('a');
	});

	it('coalesces calls inside the window into one trailing call with the latest args', () => {
		const fn = vi.fn();
		const th = throttle(fn, 100);

		th(1);
		th(2);
		th(3);
		expect(fn).toHaveBeenCalledTimes(1);
		expect(fn).toHaveBeenCalledWith(1);

		vi.advanceTimersByTime(100);
		expect(fn).toHaveBeenCalledTimes(2);
		expect(fn).toHaveBeenLastCalledWith(3);
	});

	it('keeps a continuous stream to about one invocation per window', () => {
		const fn = vi.fn();
		const th = throttle(fn, 100);

		for (let elapsed = 0; elapsed < 450; elapsed += 10) {
			th(elapsed);
			vi.advanceTimersByTime(10);
		}

		// 10ms-spaced calls up to t=450: leading at 0, then one per 100ms window.
		expect(fn).toHaveBeenCalledTimes(5);

		// The stream stopped mid-window; the trailing call lands with the latest args.
		vi.advanceTimersByTime(100);
		expect(fn).toHaveBeenCalledTimes(6);
		expect(fn).toHaveBeenLastCalledWith(440);
	});

	it('treats a call after a quiet period as a new leading edge', () => {
		const fn = vi.fn();
		const th = throttle(fn, 100);

		th('a');
		vi.advanceTimersByTime(250);
		th('b');

		expect(fn).toHaveBeenCalledTimes(2);
		expect(fn).toHaveBeenLastCalledWith('b');
	});

	it('cancel() drops the pending trailing invocation', () => {
		const fn = vi.fn();
		const th = throttle(fn, 100);

		th('a');
		th('b');
		th.cancel();
		vi.advanceTimersByTime(500);

		expect(fn).toHaveBeenCalledTimes(1);
		expect(fn).toHaveBeenCalledWith('a');
	});
});
