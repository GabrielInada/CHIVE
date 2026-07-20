/**
 * Session-only chart render approvals and the shared budget notice UI.
 *
 * Approval is held in a WeakMap keyed by the concrete chart container. It is
 * never written to application state, snapshots, localStorage, or persistence.
 */

const approvalsByContainer = new WeakMap();

/**
 * @param {HTMLElement} container
 * @param {string} chartType
 * @returns {boolean}
 */
export function hasFullRenderApproval(container, chartType) {
	return approvalsByContainer.get(container)?.has(chartType) === true;
}

/**
 * @param {HTMLElement} container
 * @param {string} chartType
 */
export function approveFullRender(container, chartType) {
	let approvals = approvalsByContainer.get(container);
	if (!approvals) {
		approvals = new Set();
		approvalsByContainer.set(container, approvals);
	}
	approvals.add(chartType);
}

/**
 * Append a localized render-budget notice and an explicit full-render action.
 *
 * @param {HTMLElement} container
 * @param {Object} options
 * @param {string} options.message
 * @param {string} options.actionLabel
 * @param {() => void} options.onApprove
 * @param {boolean} [options.blocked=false]
 * @returns {HTMLElement}
 */
export function appendRenderBudgetNotice(
	container,
	{ message, actionLabel, onApprove, blocked = false },
) {
	container.querySelector('.chart-render-budget-notice')?.remove();

	const notice = document.createElement('div');
	notice.className = 'chart-render-budget-notice';
	notice.classList.toggle('chart-render-budget-notice--blocked', blocked);
	notice.setAttribute('role', 'status');

	const text = document.createElement('span');
	text.textContent = message;

	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'btn-secondary chart-render-budget-action';
	button.textContent = actionLabel;
	button.addEventListener('click', () => {
		button.disabled = true;
		onApprove();
	}, { once: true });

	notice.append(text, button);
	container.appendChild(notice);
	return notice;
}
