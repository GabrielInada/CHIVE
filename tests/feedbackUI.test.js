// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  showFeedback,
  showError,
  clearErrors,
  showLoading,
  hideLoading,
  clearAllFeedback,
} from '../src/modules/feedbackUI.js';

describe('feedbackUI', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });

  it('cria toast de feedback e remove visibilidade após timeout', () => {
    showFeedback('ok', 100);
    const toast = document.getElementById('toast-feedback');
    expect(toast).toBeTruthy();
    expect(toast.classList.contains('visivel')).toBe(true);

    vi.advanceTimersByTime(120);
    expect(toast.classList.contains('visivel')).toBe(false);
  });

  it('mostra erro no container quando existe e permite fechar', () => {
    const errorsContainer = document.createElement('div');
    errorsContainer.id = 'erros-container';
    document.body.appendChild(errorsContainer);

    showError('boom');

    const error = errorsContainer.querySelector('.aviso-erro');
    expect(error).toBeTruthy();
    expect(error.textContent).toContain('boom');

    const close = errorsContainer.querySelector('.btn-fechar-aviso');
    close.click();
    expect(errorsContainer.querySelector('.aviso-erro')).toBeNull();
  });

  it('faz fallback para toast se container de erro não existir', () => {
    showError('fallback', 100);
    const toast = document.getElementById('toast-feedback');
    expect(toast).toBeTruthy();
    expect(toast.textContent).toBe('fallback');
  });

  it('auto-dismiss error when duration is specified', () => {
    const errorsContainer = document.createElement('div');
    errorsContainer.id = 'erros-container';
    document.body.appendChild(errorsContainer);

    showError('timed error', 200);
    expect(errorsContainer.querySelector('.aviso-erro')).toBeTruthy();

    vi.advanceTimersByTime(250);
    expect(errorsContainer.querySelector('.aviso-erro')).toBeNull();
  });

  it('reuses existing toast element on repeated calls', () => {
    showFeedback('first', 500);
    showFeedback('second', 500);
    const toasts = document.querySelectorAll('#toast-feedback');
    expect(toasts.length).toBe(1);
    expect(toasts[0].textContent).toBe('second');
  });

  it('showFeedbackMessage alias works', async () => {
    const { showFeedbackMessage } = await import('../src/modules/feedbackUI.js');
    showFeedbackMessage('alias test', 100);
    const toast = document.getElementById('toast-feedback');
    expect(toast.textContent).toBe('alias test');
  });

  it('showErrorMessage alias works', async () => {
    const { showErrorMessage } = await import('../src/modules/feedbackUI.js');
    const errorsContainer = document.createElement('div');
    errorsContainer.id = 'erros-container';
    document.body.appendChild(errorsContainer);

    showErrorMessage('alias error');
    expect(errorsContainer.querySelector('.aviso-erro')).toBeTruthy();
  });

  it('hideErrorMessage alias clears errors', async () => {
    const { hideErrorMessage } = await import('../src/modules/feedbackUI.js');
    const errorsContainer = document.createElement('div');
    errorsContainer.id = 'erros-container';
    document.body.appendChild(errorsContainer);

    showError('x');
    hideErrorMessage();
    expect(errorsContainer.innerHTML).toBe('');
  });

  it('hideLoading does nothing when element missing', () => {
    expect(() => hideLoading()).not.toThrow();
  });

  it('clearErrors does nothing when container missing', () => {
    expect(() => clearErrors()).not.toThrow();
  });

  it('limpa erros e loading em clearAllFeedback', () => {
    const errorsContainer = document.createElement('div');
    errorsContainer.id = 'erros-container';
    document.body.appendChild(errorsContainer);

    const loading = document.createElement('div');
    loading.id = 'loading-estado';
    loading.hidden = true;
    document.body.appendChild(loading);

    showError('x');
    showLoading('loading...');
    expect(loading.hidden).toBe(false);

    clearErrors();
    expect(errorsContainer.innerHTML).toBe('');

    showError('x2');
    clearAllFeedback();
    expect(errorsContainer.innerHTML).toBe('');
    expect(loading.hidden).toBe(true);

    hideLoading();
    expect(loading.hidden).toBe(true);
  });
});
