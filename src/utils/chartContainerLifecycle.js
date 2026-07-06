/**
 * Chart container lifecycle: the dispose-aware way to empty a chart
 * container, plus the shared empty-state message renderer.
 *
 * Canvas/WebGL renderers stash a disposer on their container under
 * `CHART_DISPOSE_HOOK` (event listeners, GPU resources, the rendering
 * context). Every generic clear path (workspace chart clears, panel slot
 * teardown and resize re-render) goes through `clearChartContainer` so
 * the disposer always runs before the DOM is emptied. SVG charts never
 * set the hook and are unaffected. Only this module reads or deletes the
 * hook property; renderers only assign it.
 *
 * This is a deliberate exception to the utils "DOM-free" rule: the
 * helper must be importable by components, the panel subsystem, and
 * chart packages alike, and utils is the one layer all three may reach.
 */

export const CHART_DISPOSE_HOOK = '__chiveChartDispose__';

/**
 * Run and remove any stashed dispose hook, then empty the container.
 * No-op for a null/undefined container, so call sites can drop their
 * own existence checks. A throwing stale hook is swallowed (warn only):
 * the hook reference and the DOM contents are removed regardless, so a
 * broken disposer cannot poison later renders.
 *
 * @param {HTMLElement | null | undefined} container
 * @returns {void}
 */
export function clearChartContainer(container) {
	if (!container) return;
	const dispose = container[CHART_DISPOSE_HOOK];
	if (typeof dispose === 'function') {
		try {
			dispose();
		} catch (error) {
			console.warn('Chart dispose hook threw while clearing container:', error);
		}
	}
	delete container[CHART_DISPOSE_HOOK];
	container.replaceChildren();
}

/**
 * Show an empty-state message inside a chart container. Replaces the
 * container's contents with a single `.chart-empty` element. Used by every
 * `*ChartSection` adapter when the underlying renderer returns `fail`.
 * Accepts the container element itself or its id (panel slot containers
 * have no id). No-op when neither resolves.
 *
 * @param {HTMLElement | string | null | undefined} containerOrId
 * @param {string} message - Already localized.
 * @returns {void}
 */
export function showChartMessage(containerOrId, message) {
	const container = typeof containerOrId === 'string'
		? document.getElementById(containerOrId)
		: containerOrId;
	if (!container) return;
	clearChartContainer(container);
	const empty = document.createElement('div');
	empty.className = 'chart-empty';
	empty.textContent = message;
	container.appendChild(empty);
}
