// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  showFeedback,
  showError,
  clearErrors,
  clearAllFeedback,
} from '../../src/ui/feedback.js';

describe('ui/feedback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });

  it('creates a polite feedback region and removes the notice after timeout', () => {
    showFeedback('ok', 100);
    const region = document.getElementById('feedback-region');
    const toast = region.querySelector('.toast-feedback');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(toast).toBeTruthy();

    vi.advanceTimersByTime(120);
    expect(region.querySelector('.toast-feedback')).toBeNull();
  });

  it('shows error in container when it exists and allows closing', () => {
    const errorsContainer = document.createElement('div');
    errorsContainer.id = 'errors-container';
    document.body.appendChild(errorsContainer);

    showError('boom');

    const error = errorsContainer.querySelector('.error-notice');
    expect(error).toBeTruthy();
    expect(error.textContent).toContain('boom');

    const close = errorsContainer.querySelector('.btn-close-notice');
    close.click();
    expect(errorsContainer.querySelector('.error-notice')).toBeNull();
  });

  it('defensively creates an assertive error region when it is missing', () => {
    showError('fallback');
    const region = document.getElementById('errors-container');
    expect(region.getAttribute('aria-live')).toBe('assertive');
    expect(region.querySelector('.error-notice')?.textContent).toContain('fallback');
  });

  it('auto-dismiss error when duration is specified', () => {
    const errorsContainer = document.createElement('div');
    errorsContainer.id = 'errors-container';
    document.body.appendChild(errorsContainer);

    showError('timed error', 200);
    expect(errorsContainer.querySelector('.error-notice')).toBeTruthy();

    vi.advanceTimersByTime(250);
    expect(errorsContainer.querySelector('.error-notice')).toBeNull();
  });

  it('preserves concurrent transient feedback notices', () => {
    showFeedback('first', 500);
    showFeedback('second', 500);
    const toasts = document.querySelectorAll('#feedback-region .toast-feedback');
    expect([...toasts].map(toast => toast.textContent)).toEqual(['first', 'second']);
  });

  it('clearErrors does nothing when container missing', () => {
    expect(() => clearErrors()).not.toThrow();
  });

  it('clears all polite and assertive notices', () => {
    const errorsContainer = document.createElement('div');
    errorsContainer.id = 'errors-container';
    document.body.appendChild(errorsContainer);

    showError('x');
    showFeedback('ok');
    clearAllFeedback();
    expect(errorsContainer.innerHTML).toBe('');
    expect(document.getElementById('feedback-region').innerHTML).toBe('');
  });
});
