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
export function showFeedbackMessage(message, duration = 2200) {
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
export function showErrorMessage(message, duration = 0) {
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
export function hideErrorMessage() {
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
	if (activeProgressHandle) activeProgressHandle.close();
}

const PROGRESS_TOAST_ID = 'toast-progress';
let activeProgressHandle = null;

/**
 * Show a non-modal progress toast with a cancellable progress bar.
 *
 * Single-instance: a second call closes the previous toast first. The handle
 * lets callers report progress, then transition into success or failure
 * states. Failure persists until the × button is clicked; success
 * auto-closes after `autoCloseMs`.
 *
 * @param {string} initialLabel - Text shown above the bar at 0% progress.
 * @returns {{
 *   update: (percent: number, label?: string) => void,
 *   succeed: (message?: string, autoCloseMs?: number) => void,
 *   fail: (message?: string) => void,
 *   close: () => void,
 *   onCancel: (handler: () => void) => void,
 * }}
 */
export function showProgress(initialLabel = '') {
	if (activeProgressHandle) activeProgressHandle.close();

	const toast = document.createElement('div');
	toast.id = PROGRESS_TOAST_ID;
	toast.className = 'toast-progress';
	toast.setAttribute('role', 'status');
	toast.setAttribute('aria-live', 'polite');
	toast.setAttribute('aria-atomic', 'false');

	const labelEl = document.createElement('span');
	labelEl.className = 'toast-progress-label';
	labelEl.textContent = initialLabel;
	toast.appendChild(labelEl);

	const percentEl = document.createElement('span');
	percentEl.className = 'toast-progress-percent';
	percentEl.textContent = '0%';
	toast.appendChild(percentEl);

	const cancelBtn = document.createElement('button');
	cancelBtn.type = 'button';
	cancelBtn.className = 'toast-progress-cancel';
	cancelBtn.setAttribute('aria-label', 'Cancel');
	cancelBtn.textContent = '×';
	toast.appendChild(cancelBtn);

	const bar = document.createElement('div');
	bar.className = 'toast-progress-bar';
	bar.setAttribute('role', 'progressbar');
	bar.setAttribute('aria-valuemin', '0');
	bar.setAttribute('aria-valuemax', '100');
	bar.setAttribute('aria-valuenow', '0');
	const fill = document.createElement('div');
	fill.className = 'toast-progress-fill';
	bar.appendChild(fill);
	toast.appendChild(bar);

	document.body.appendChild(toast);
	// Force reflow so the visivel transition runs.
	requestAnimationFrame(() => toast.classList.add('visivel'));

	let cancelHandler = null;
	// 'callback' while in-flight (× aborts host work);
	// 'close'    after succeed/fail (× just dismisses the toast).
	let cancelMode = 'callback';
	let autoCloseTimer = null;

	const onCancelClick = () => {
		if (cancelMode === 'close') {
			handle.close();
			return;
		}
		if (typeof cancelHandler === 'function') cancelHandler();
	};
	cancelBtn.addEventListener('click', onCancelClick);

	const handle = {
		update(percent, label) {
			const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
			const rounded = Math.round(clamped);
			fill.style.width = `${clamped}%`;
			percentEl.textContent = `${rounded}%`;
			bar.setAttribute('aria-valuenow', String(rounded));
			if (label) labelEl.textContent = label;
		},
		succeed(message, autoCloseMs = 1500) {
			toast.classList.add('success');
			fill.style.width = '100%';
			percentEl.textContent = '100%';
			bar.setAttribute('aria-valuenow', '100');
			if (message) labelEl.textContent = message;
			cancelMode = 'close';
			if (autoCloseTimer) window.clearTimeout(autoCloseTimer);
			autoCloseTimer = window.setTimeout(() => handle.close(), autoCloseMs);
		},
		fail(message) {
			toast.classList.add('failure');
			if (message) labelEl.textContent = message;
			cancelMode = 'close';
			// No auto-close — user must dismiss via × so the error stays readable.
		},
		close() {
			if (autoCloseTimer) window.clearTimeout(autoCloseTimer);
			cancelBtn.removeEventListener('click', onCancelClick);
			toast.classList.remove('visivel');
			window.setTimeout(() => {
				if (toast.parentNode) toast.parentNode.removeChild(toast);
			}, 200);
			if (activeProgressHandle === handle) activeProgressHandle = null;
		},
		onCancel(handler) {
			cancelHandler = typeof handler === 'function' ? handler : null;
		},
	};

	activeProgressHandle = handle;
	return handle;
}
