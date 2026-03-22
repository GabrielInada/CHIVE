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
