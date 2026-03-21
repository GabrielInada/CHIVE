/**
 * CHIVE Feedback UI
 * 
 * Manages user-facing feedback:
 * - Toast notifications (success, info)
 * - Error messages
 * - Loading states
 */

import { t } from '../services/i18nService.js';

let feedbackTimer = null;
let errorTimer = null;

/**
 * Show success/info feedback toast (auto-dismisses)
 * @param {string} message - Message text or i18n key
 * @param {number} duration - Duration in ms (default 2200)
 */
export function showFeedback(message, duration = 2200) {
	let toast = document.getElementById('toast-feedback');
	if (!toast) {
		toast = document.createElement('div');
		toast.id = 'toast-feedback';
		toast.className = 'toast-feedback';
		document.body.appendChild(toast);
	}

	toast.textContent = message;
	toast.classList.add('visivel');

	if (feedbackTimer) window.clearTimeout(feedbackTimer);
	feedbackTimer = window.setTimeout(() => {
		toast.classList.remove('visivel');
	}, duration);
}

/**
 * Alias for showFeedback (backwards compatibility)
 */
export function mostrarFeedback(message, duration = 2200) {
	showFeedback(message, duration);
}

/**
 * Show error message (persistent until manually closed or timeout)
 * @param {string} message - Message text or i18n key
 * @param {number} duration - Auto-dismiss duration in ms (0 = no autodismiss)
 */
export function showError(message, duration = 0) {
	const errorsContainer = document.getElementById('erros-container');
	if (!errorsContainer) {
		showFeedback(message, duration || 2200);
		return;
	}

	const errorDiv = document.createElement('div');
	errorDiv.className = 'aviso-erro';
	errorDiv.role = 'alert';

	const content = document.createElement('div');
	content.textContent = message;

	const closeBtn = document.createElement('button');
	closeBtn.className = 'btn-fechar-aviso';
	closeBtn.type = 'button';
	closeBtn.textContent = '×';
	closeBtn.addEventListener('click', () => {
		errorDiv.remove();
		if (errorTimer) window.clearTimeout(errorTimer);
	});

	errorDiv.appendChild(content);
	errorDiv.appendChild(closeBtn);
	errorsContainer.appendChild(errorDiv);

	// Auto-dismiss if duration specified
	if (duration > 0) {
		if (errorTimer) window.clearTimeout(errorTimer);
		errorTimer = window.setTimeout(() => {
			errorDiv.remove();
		}, duration);
	}
}

/**
 * Alias for showError (backwards compatibility)
 */
export function mostrarErro(message, duration = 0) {
	showError(message, duration);
}

/**
 * Clear all error messages
 */
export function clearErrors() {
	const errorsContainer = document.getElementById('erros-container');
	if (errorsContainer) {
		errorsContainer.innerHTML = '';
	}
	if (errorTimer) window.clearTimeout(errorTimer);
}

/**
 * Alias for clearErrors (backwards compatibility)
 */
export function esconderErro() {
	clearErrors();
}

/**
 * Show loading state
 * @param {string} message - Loading message
 */
export function showLoading(message) {
	const loadingEl = document.getElementById('loading-estado');
	if (loadingEl) {
		loadingEl.innerHTML = '';
		const spinner = document.createElement('div');
		spinner.className = 'loading-spinner';
		const text = document.createElement('p');
		text.textContent = message;
		loadingEl.appendChild(spinner);
		loadingEl.appendChild(text);
		loadingEl.hidden = false;
	}
}

/**
 * Hide loading state
 */
export function hideLoading() {
	const loadingEl = document.getElementById('loading-estado');
	if (loadingEl) {
		loadingEl.hidden = true;
	}
}

/**
 * Clear all feedback UI (toasts + errors)
 */
export function clearAllFeedback() {
	const toast = document.getElementById('toast-feedback');
	if (toast) {
		toast.classList.remove('visivel');
	}
	clearErrors();
	hideLoading();
}
