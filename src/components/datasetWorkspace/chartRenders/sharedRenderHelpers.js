/**
 * Show an empty-state message inside a chart container. Replaces the
 * container's contents with a single `.chart-empty` element. Used by every
 * `*ChartSection` adapter when the underlying renderer returns `fail`.
 *
 * @param {string} containerId
 * @param {string} message - Already localized.
 * @returns {void}
 */
export function showChartMessage(containerId, message) {
	const container = document.getElementById(containerId);
	container.replaceChildren();
	const empty = document.createElement('div');
	empty.className = 'chart-empty';
	empty.textContent = message;
	container.appendChild(empty);
}
