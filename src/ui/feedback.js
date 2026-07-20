/**
 * CHIVE Feedback UI.
 *
 * Manages user-facing feedback:
 *   - Toast notifications (success, info)
 *   - Error messages
 *   - Cancellable progress toast (see {@link showProgress})
 *
 * @typedef {import('../types.js').ProgressHandle} ProgressHandle
 */

const FEEDBACK_REGION_ID = 'feedback-region';
const ERRORS_REGION_ID = 'errors-container';
const feedbackTimers = new Set();
const errorTimers = new Set();

/**
 * Static HTML owns these regions. This fallback keeps top-level error handling
 * useful if a host page is incomplete or a test mounts only part of the shell.
 *
 * @param {string} id
 * @param {'polite' | 'assertive'} politeness
 * @param {string} className
 * @returns {HTMLElement}
 */
function getLiveRegion(id, politeness, className) {
	let region = document.getElementById(id);
	if (region) return region;

	region = document.createElement('div');
	region.id = id;
	region.className = className;
	region.setAttribute('aria-live', politeness);
	region.setAttribute('aria-atomic', 'false');
	document.body.appendChild(region);
	return region;
}

/**
 * @param {HTMLElement} notice
 * @param {number} duration
 * @param {Set<number>} timerSet
 */
function removeAfter(notice, duration, timerSet) {
	const timer = window.setTimeout(() => {
		notice.remove();
		timerSet.delete(timer);
	}, duration);
	timerSet.add(timer);
}

/**
 * Show success/info feedback toast (auto-dismisses)
 * @param {string} message - Message text or i18n key
 * @param {number} duration - Duration in ms (default 2200)
 */
export function showFeedback(message, duration = 2200) {
	const region = getLiveRegion(FEEDBACK_REGION_ID, 'polite', 'feedback-region');
	const notice = document.createElement('div');
	notice.className = 'toast-feedback';
	notice.textContent = message;
	region.appendChild(notice);
	requestAnimationFrame(() => notice.classList.add('visible'));
	removeAfter(notice, Math.max(0, duration), feedbackTimers);
}

/**
 * Show error message (persistent until manually closed or timeout)
 * @param {string} message - Message text or i18n key
 * @param {number} duration - Auto-dismiss duration in ms (0 = no autodismiss)
 */
export function showError(message, duration = 0) {
	const errorsContainer = getLiveRegion(ERRORS_REGION_ID, 'assertive', 'errors-container');

	const errorDiv = document.createElement('div');
	errorDiv.className = 'error-notice';

	const content = document.createElement('div');
	content.textContent = message;

	const closeBtn = document.createElement('button');
	closeBtn.className = 'btn-close-notice';
	closeBtn.type = 'button';
	closeBtn.setAttribute('aria-label', errorsContainer.dataset.closeLabel || 'Close');
	closeBtn.textContent = '×';
	closeBtn.addEventListener('click', () => {
		errorDiv.remove();
	});

	errorDiv.appendChild(content);
	errorDiv.appendChild(closeBtn);
	errorsContainer.appendChild(errorDiv);

	if (duration > 0) {
		removeAfter(errorDiv, duration, errorTimers);
	}
}

/**
 * Clear all error messages
 */
export function clearErrors() {
	const errorsContainer = document.getElementById(ERRORS_REGION_ID);
	if (errorsContainer) {
		errorsContainer.replaceChildren();
	}
	for (const timer of errorTimers) window.clearTimeout(timer);
	errorTimers.clear();
}

/**
 * Clear all feedback UI (toasts + errors)
 */
export function clearAllFeedback() {
	const region = document.getElementById(FEEDBACK_REGION_ID);
	if (region) region.replaceChildren();
	for (const timer of feedbackTimers) window.clearTimeout(timer);
	feedbackTimers.clear();
	clearErrors();
	if (activeProgressHandle) activeProgressHandle.close();
}

const PROGRESS_TOAST_ID = 'toast-progress';
let activeProgressHandle = null;

/**
 * Show a non-modal progress toast with a cancellable progress bar.
 *
 * Single-instance: a second call closes the previous toast first. The
 * returned handle lets callers report progress, then transition into
 * success or failure states. Failure persists until the × button is
 * clicked; success auto-closes after `autoCloseMs`.
 *
 * @param {string} initialLabel - Text shown above the bar at 0% progress.
 * @returns {ProgressHandle}
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
	// WHY: rAF defers the class-add to the next frame, which forces a layout
	// pass between the initial mount and the transition trigger. Without this,
	// the .visible transition runs on the initial style (no visual fade-in).
	requestAnimationFrame(() => toast.classList.add('visible'));

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
			// WHY: succeed flips cancelMode to 'close' (× now dismisses; it no longer
			// invokes the host's cancel handler) and auto-closes after autoCloseMs.
			// Symmetric with fail(), except fail does NOT auto-close, since an error
			// must stay visible until the user has read it.
			cancelMode = 'close';
			if (autoCloseTimer) window.clearTimeout(autoCloseTimer);
			autoCloseTimer = window.setTimeout(() => handle.close(), autoCloseMs);
		},
		fail(message) {
			toast.classList.add('failure');
			if (message) labelEl.textContent = message;
			cancelMode = 'close';
			// No auto-close, user must dismiss via × so the error stays readable.
		},
		close() {
			if (autoCloseTimer) window.clearTimeout(autoCloseTimer);
			cancelBtn.removeEventListener('click', onCancelClick);
			toast.classList.remove('visible');
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
