// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { showProgress } from '../../src/modules/feedbackUI.js';

describe('showProgress', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	afterEach(() => {
		// Clean up any lingering toasts so tests don't bleed state.
		document.querySelectorAll('.toast-progress').forEach(el => el.remove());
	});

	it('mounts a toast with label, progress bar, and × cancel button', () => {
		const handle = showProgress('Loading data...');
		const toast = document.querySelector('.toast-progress');
		expect(toast).toBeTruthy();
		expect(toast.querySelector('.toast-progress-label').textContent).toBe('Loading data...');
		expect(toast.querySelector('.toast-progress-percent').textContent).toBe('0%');
		const bar = toast.querySelector('.toast-progress-bar');
		expect(bar.getAttribute('role')).toBe('progressbar');
		expect(bar.getAttribute('aria-valuenow')).toBe('0');
		expect(toast.querySelector('.toast-progress-cancel')).toBeTruthy();
		handle.close();
	});

	it('update() reflects percent in fill width, percent text, aria-valuenow', () => {
		const handle = showProgress('go');
		handle.update(42);
		expect(document.querySelector('.toast-progress-fill').style.width).toBe('42%');
		expect(document.querySelector('.toast-progress-percent').textContent).toBe('42%');
		expect(document.querySelector('.toast-progress-bar').getAttribute('aria-valuenow')).toBe('42');
		handle.close();
	});

	it('update() clamps to [0, 100] and rounds the displayed percent', () => {
		const handle = showProgress('go');
		handle.update(200);
		expect(document.querySelector('.toast-progress-percent').textContent).toBe('100%');
		handle.update(-5);
		expect(document.querySelector('.toast-progress-percent').textContent).toBe('0%');
		handle.update(33.6);
		expect(document.querySelector('.toast-progress-percent').textContent).toBe('34%');
		handle.close();
	});

	it('update() can change the label mid-flight', () => {
		const handle = showProgress('initial');
		handle.update(50, 'Computing stats...');
		expect(document.querySelector('.toast-progress-label').textContent).toBe('Computing stats...');
		handle.close();
	});

	it('succeed() adds .success and schedules auto-close after autoCloseMs', () => {
		vi.useFakeTimers();
		try {
			const handle = showProgress('go');
			handle.succeed('done!', 1000);
			expect(document.querySelector('.toast-progress').classList.contains('success')).toBe(true);
			expect(document.querySelector('.toast-progress-label').textContent).toBe('done!');

			vi.advanceTimersByTime(999);
			expect(document.querySelector('.toast-progress')).toBeTruthy();

			vi.advanceTimersByTime(1);
			// close() then schedules a 200ms removal
			vi.advanceTimersByTime(250);
			expect(document.querySelector('.toast-progress')).toBeFalsy();
			handle.close();
		} finally {
			vi.useRealTimers();
		}
	});

	it('fail() adds .failure and does NOT auto-close', () => {
		vi.useFakeTimers();
		try {
			const handle = showProgress('go');
			handle.fail('error!');
			expect(document.querySelector('.toast-progress').classList.contains('failure')).toBe(true);
			expect(document.querySelector('.toast-progress-label').textContent).toBe('error!');

			vi.advanceTimersByTime(60000);
			expect(document.querySelector('.toast-progress')).toBeTruthy();
			handle.close();
			vi.advanceTimersByTime(250);
		} finally {
			vi.useRealTimers();
		}
	});

	it('onCancel() handler runs on × click while in-progress', () => {
		const handle = showProgress('go');
		const cb = vi.fn();
		handle.onCancel(cb);
		document.querySelector('.toast-progress-cancel').click();
		expect(cb).toHaveBeenCalledTimes(1);
		handle.close();
	});

	it('× click in failure state closes the toast directly without firing onCancel', () => {
		vi.useFakeTimers();
		try {
			const handle = showProgress('go');
			const cb = vi.fn();
			handle.onCancel(cb);
			handle.fail('boom');
			document.querySelector('.toast-progress-cancel').click();
			expect(cb).not.toHaveBeenCalled();
			vi.advanceTimersByTime(250);
			expect(document.querySelector('.toast-progress')).toBeFalsy();
		} finally {
			vi.useRealTimers();
		}
	});

	it('a second showProgress() call replaces the first', () => {
		vi.useFakeTimers();
		try {
			showProgress('first');
			showProgress('second');
			vi.advanceTimersByTime(250); // let first's removal timer fire

			const remaining = Array.from(document.querySelectorAll('.toast-progress-label')).map(el => el.textContent);
			expect(remaining).toEqual(['second']);
		} finally {
			vi.useRealTimers();
		}
	});
});
